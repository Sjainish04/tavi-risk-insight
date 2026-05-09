"""Load the trained LightGBM and produce calibrated predictions + SHAP."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import shap

from tavi_api.data.synthetic import FEATURE_COLUMNS
from tavi_api.schemas import PatientInput, ShapContribution


def _patient_to_row(p: PatientInput) -> np.ndarray:
    """Order MUST match FEATURE_COLUMNS in data/synthetic.py."""
    return np.array(
        [
            p.age_years,
            float(p.sex == "female"),
            p.bmi,
            p.lvef_pct,
            p.egfr,
            p.creatinine_mg_dl,
            p.hemoglobin_g_dl,
            p.albumin_g_dl,
            p.nt_probnp_pg_ml if p.nt_probnp_pg_ml is not None else 1500.0,
            float(p.diabetes),
            float(p.chronic_lung_disease),
            float(p.prior_mi),
            float(p.prior_pci),
            float(p.prior_cabg),
            float(p.prior_stroke),
            float(p.peripheral_vascular_disease),
            float(p.atrial_fibrillation),
            float(p.prior_pacemaker),
            float(p.on_dialysis),
            {"I": 1, "II": 2, "III": 3, "IV": 4}[p.nyha_class],
            {"elective": 0, "urgent": 1, "emergent": 2}[p.urgency],
            p.gait_speed_m_per_s if p.gait_speed_m_per_s is not None else 0.85,
            # CT-derived (NaN when not provided — LightGBM handles NaN natively)
            p.annular_area_mm2 if p.annular_area_mm2 is not None else np.nan,
            p.calcium_volume_au if p.calcium_volume_au is not None else np.nan,
            p.membranous_septum_length_mm
            if p.membranous_septum_length_mm is not None
            else np.nan,
            p.distance_to_left_main_mm
            if p.distance_to_left_main_mm is not None
            else np.nan,
        ],
        dtype=float,
    )


@dataclass
class RiskModel:
    classifier: Any
    calibrator: Any
    metadata: dict[str, Any]
    explainer: shap.TreeExplainer

    def predict(self, patient: PatientInput) -> tuple[float, list[ShapContribution]]:
        row = _patient_to_row(patient).reshape(1, -1)
        proba = float(self.calibrator.predict_proba(row)[0, 1])
        # SHAP on the raw classifier (trees) — we explain the pre-calibration model
        shap_vals = self.explainer.shap_values(row)
        # LightGBM binary returns either a single array or [class0, class1]
        if isinstance(shap_vals, list) and len(shap_vals) == 2:
            sv = shap_vals[1][0]
        else:
            sv = np.asarray(shap_vals)[0]

        feat_values = row[0]
        order = np.argsort(np.abs(sv))[::-1]
        top: list[ShapContribution] = []
        for idx in order[:5]:
            shap_val = float(sv[idx])
            top.append(
                ShapContribution(
                    feature=FEATURE_COLUMNS[idx],
                    value=_present_value(FEATURE_COLUMNS[idx], feat_values[idx]),
                    shap_value=shap_val,
                    direction="increases" if shap_val > 0 else "decreases",
                )
            )
        return proba, top


def _present_value(name: str, raw: float) -> float | str | bool:
    """Render a feature value in a friendly form for display."""
    bool_features = {
        "sex_female",
        "diabetes",
        "chronic_lung_disease",
        "prior_mi",
        "prior_pci",
        "prior_cabg",
        "prior_stroke",
        "peripheral_vascular_disease",
        "atrial_fibrillation",
        "prior_pacemaker",
        "on_dialysis",
    }
    if name in bool_features:
        return bool(raw)
    if name == "nyha_class_num":
        return ["I", "II", "III", "IV"][int(raw) - 1]
    if name == "urgency_num":
        return ["elective", "urgent", "emergent"][int(raw)]
    return float(round(raw, 2))


def load_model(model_dir: str | Path = "models") -> RiskModel:
    model_dir = Path(model_dir)
    classifier = joblib.load(model_dir / "baseline_lgbm.pkl")
    calibrator = joblib.load(model_dir / "calibrator.pkl")
    metadata = json.loads((model_dir / "metadata.json").read_text())
    explainer = shap.TreeExplainer(classifier)
    return RiskModel(classifier, calibrator, metadata, explainer)


# ---------- v3 Stacking model (production winner among local variants) ----------


@dataclass
class StackingRiskModel:
    """v3 ensemble: LGBM + CatBoost + LR (final estimator LR), trained with brdav as
    feature 27. SHAP is computed on the inner LGBM submodel — explains the LGBM's
    contribution within the ensemble, not the full stacked output (sklearn doesn't
    expose ensemble-level attributions; this is the standard hackathon compromise).
    """

    stacking: Any  # fitted sklearn StackingClassifier
    calibrator: Any  # CalibratedClassifierCV wrapping FrozenEstimator(stacking)
    metadata: dict[str, Any]
    explainer: shap.TreeExplainer

    def predict(
        self, patient: PatientInput, brdav_prob: float
    ) -> tuple[float, list[ShapContribution]]:
        row_26 = _patient_to_row(patient)
        row = np.concatenate([row_26, [float(brdav_prob)]])
        proba = float(self.calibrator.predict_proba(row.reshape(1, -1))[0, 1])

        shap_vals = self.explainer.shap_values(row.reshape(1, -1))
        if isinstance(shap_vals, list) and len(shap_vals) == 2:
            sv = shap_vals[1][0]
        else:
            sv = np.asarray(shap_vals)[0]

        feat_names = list(FEATURE_COLUMNS) + ["brdav_followup"]
        order = np.argsort(np.abs(sv))[::-1]
        top: list[ShapContribution] = []
        for idx in order[:5]:
            shap_val = float(sv[idx])
            top.append(
                ShapContribution(
                    feature=feat_names[idx],
                    value=_present_value(feat_names[idx], row[idx]),
                    shap_value=shap_val,
                    direction="increases" if shap_val > 0 else "decreases",
                )
            )
        return proba, top


def load_stacking_model(model_dir: str | Path = "models") -> StackingRiskModel | None:
    """Load v3 stacking artifacts if present; return None if not yet trained."""
    model_dir = Path(model_dir)
    stacking_path = model_dir / "v3_stacking_brdav.pkl"
    cal_path = model_dir / "calibrator_v3_stacking_brdav.pkl"
    if not (stacking_path.exists() and cal_path.exists()):
        return None
    stacking = joblib.load(stacking_path)
    calibrator = joblib.load(cal_path)
    inner_lgbm = stacking.named_estimators_["lgbm"]
    explainer = shap.TreeExplainer(inner_lgbm)
    metadata_path = model_dir / "metadata.json"
    metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
    return StackingRiskModel(
        stacking=stacking, calibrator=calibrator, explainer=explainer, metadata=metadata
    )
