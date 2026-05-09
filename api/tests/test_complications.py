"""Tests for procedural complication risks."""

from __future__ import annotations

from tavi_api.scoring.complications import compute_complications

from ._helpers import patient


def test_clean_patient_near_baseline() -> None:
    r = compute_complications(patient())
    assert 0.005 <= r.stroke_30d.p <= 0.025
    assert r.aki_2_3_30d.p <= 0.05
    assert 0.01 <= r.major_vascular_30d.p <= 0.04
    # CI sanity
    for endpoint in (
        r.stroke_30d,
        r.aki_2_3_30d,
        r.major_vascular_30d,
        r.life_threatening_bleed_30d,
    ):
        assert endpoint.lo <= endpoint.p <= endpoint.hi
        assert endpoint.base_rate > 0
        assert endpoint.multiplier_vs_base > 0


def test_prior_stroke_doubles_stroke_risk() -> None:
    base = compute_complications(patient())
    high = compute_complications(patient(prior_stroke=True))
    assert high.stroke_30d.p > 1.8 * base.stroke_30d.p


def test_severe_PVD_lifts_vascular_risk() -> None:
    base = compute_complications(patient())
    pvd = compute_complications(patient(peripheral_vascular_disease=True, bmi=20))
    assert pvd.major_vascular_30d.p > 2.0 * base.major_vascular_30d.p


def test_low_egfr_lifts_aki() -> None:
    base = compute_complications(patient())
    ckd = compute_complications(patient(egfr=30, creatinine_mg_dl=2.4))
    assert ckd.aki_2_3_30d.p > 2.0 * base.aki_2_3_30d.p


def test_anemia_and_afib_lift_bleed() -> None:
    base = compute_complications(patient())
    high = compute_complications(patient(hemoglobin_g_dl=10.0, atrial_fibrillation=True))
    assert high.life_threatening_bleed_30d.p > 2.0 * base.life_threatening_bleed_30d.p


def test_dialysis_disables_aki_endpoint() -> None:
    r = compute_complications(patient(on_dialysis=True, egfr=10, creatinine_mg_dl=6))
    assert r.aki_2_3_30d.p < 0.005
