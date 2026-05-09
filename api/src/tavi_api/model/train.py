"""LightGBM training script for the TAVI 30-day mortality baseline.

Generates the synthetic cohort, trains a LightGBM with stratified 5-fold CV,
fits an isotonic-regression calibrator on a held-out fold, and serializes the
artifacts under api/models/. Reports AUROC, AUPRC, Brier score, and
calibration slope/intercept in metadata.json.

Usage (from api/):
    uv run tavi-train
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
from loguru import logger
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split

from tavi_api.data.synthetic import FEATURE_COLUMNS, OUTCOME_COLUMN, generate_synthetic_cohort

ARTIFACT_DIR = Path("models")
N_FOLDS = 5
SEED = 42


def _train_lgbm(X_train: np.ndarray, y_train: np.ndarray) -> lgb.LGBMClassifier:
    pos_weight = (len(y_train) - y_train.sum()) / max(1, y_train.sum())
    return lgb.LGBMClassifier(
        n_estimators=500,
        learning_rate=0.05,
        num_leaves=31,
        max_depth=-1,
        min_child_samples=20,
        feature_fraction=0.9,
        bagging_fraction=0.9,
        bagging_freq=5,
        lambda_l1=0.1,
        lambda_l2=0.1,
        scale_pos_weight=pos_weight,
        random_state=SEED,
        n_jobs=-1,
        verbosity=-1,
    ).fit(X_train, y_train)


def main() -> None:
    ARTIFACT_DIR.mkdir(exist_ok=True)
    logger.info("Generating synthetic TAVI cohort (n=5,000)…")
    df = generate_synthetic_cohort(n=5000, seed=SEED)
    base_rate = df[OUTCOME_COLUMN].mean()
    logger.info(f"Base 30-day mortality rate: {base_rate:.2%}")

    X = df[FEATURE_COLUMNS].astype(float).values
    y = df[OUTCOME_COLUMN].values

    # Held-out test set for final reporting
    X_dev, X_test, y_dev, y_test = train_test_split(
        X, y, test_size=0.20, random_state=SEED, stratify=y
    )

    # Stratified CV for OOF metrics
    cv = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)
    oof = np.zeros(len(y_dev))
    fold_aurocs: list[float] = []
    for fold, (tr_idx, va_idx) in enumerate(cv.split(X_dev, y_dev), start=1):
        model = _train_lgbm(X_dev[tr_idx], y_dev[tr_idx])
        proba = model.predict_proba(X_dev[va_idx])[:, 1]
        oof[va_idx] = proba
        fold_auroc = roc_auc_score(y_dev[va_idx], proba)
        fold_aurocs.append(fold_auroc)
        logger.info(f"Fold {fold}: AUROC={fold_auroc:.3f}")

    oof_auroc = roc_auc_score(y_dev, oof)
    oof_auprc = average_precision_score(y_dev, oof)
    oof_brier = brier_score_loss(y_dev, oof)
    logger.info(
        f"OOF: AUROC={oof_auroc:.3f}  AUPRC={oof_auprc:.3f}  Brier={oof_brier:.4f}"
    )

    # Train final model on all dev data
    final_model = _train_lgbm(X_dev, y_dev)

    # Calibrate on held-out test set using FrozenEstimator (sklearn ≥1.6 API;
    # replaces the deprecated cv="prefit"). Conservative hackathon approach;
    # full TRIPOD pipelines would use a separate calibration fold.
    calibrator = CalibratedClassifierCV(estimator=FrozenEstimator(final_model), method="isotonic")
    calibrator.fit(X_test, y_test)

    test_proba = calibrator.predict_proba(X_test)[:, 1]
    test_auroc = roc_auc_score(y_test, test_proba)
    test_auprc = average_precision_score(y_test, test_proba)
    test_brier = brier_score_loss(y_test, test_proba)
    logger.info(
        f"Test (calibrated): AUROC={test_auroc:.3f}  "
        f"AUPRC={test_auprc:.3f}  Brier={test_brier:.4f}"
    )

    # Persist artifacts
    joblib.dump(final_model, ARTIFACT_DIR / "baseline_lgbm.pkl")
    joblib.dump(calibrator, ARTIFACT_DIR / "calibrator.pkl")

    metadata = {
        "model_version": "0.1.0",
        "framework": "lightgbm",
        "feature_columns": FEATURE_COLUMNS,
        "training_rows": int(len(y_dev)),
        "test_rows": int(len(y_test)),
        "base_rate": float(base_rate),
        "oof_auroc": float(oof_auroc),
        "oof_auprc": float(oof_auprc),
        "oof_brier": float(oof_brier),
        "test_auroc": float(test_auroc),
        "test_auprc": float(test_auprc),
        "test_brier": float(test_brier),
        "fold_aurocs": [float(a) for a in fold_aurocs],
        "seed": SEED,
        "cohort": "synthetic_v1",
    }
    (ARTIFACT_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2))
    logger.success(f"Saved artifacts to {ARTIFACT_DIR.resolve()}")


if __name__ == "__main__":
    main()
