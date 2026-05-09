"""Tests for the futility composite score."""

from __future__ import annotations

from tavi_api.scoring.futility import assess_futility

from ._helpers import patient


def test_robust_patient_not_futile() -> None:
    r = assess_futility(
        patient(
            age_years=75,
            albumin_g_dl=4.2,
            gait_speed_m_per_s=1.0,
            clinical_frailty_scale=3,
        )
    )
    assert not r.is_futile
    assert r.composite_score < 0.5


def test_severe_frailty_triggers_futility() -> None:
    r = assess_futility(
        patient(
            age_years=92,
            albumin_g_dl=2.6,
            clinical_frailty_scale=8,
            chronic_lung_disease=True,
            on_dialysis=True,
            gait_speed_m_per_s=0.3,
        )
    )
    assert r.is_futile
    assert any("CFS" in d for d in r.drivers)
    assert r.alternative.lower().startswith("medical therapy")


def test_moderate_frailty_below_threshold() -> None:
    r = assess_futility(patient(clinical_frailty_scale=5, age_years=82))
    assert not r.is_futile
    assert r.composite_score < 0.5


def test_alternative_excludes_savr() -> None:
    r = assess_futility(patient(age_years=92, albumin_g_dl=2.5, clinical_frailty_scale=8))
    assert "SAVR" in r.alternative or "surgery" in r.alternative.lower()
