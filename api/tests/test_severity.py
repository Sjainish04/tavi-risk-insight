"""Tests for AS severity assessment."""

from __future__ import annotations

from tavi_api.scoring.severity import assess_severity

from ._helpers import patient


def test_high_gradient_severe_AS_is_severe() -> None:
    r = assess_severity(patient())
    assert r.is_severe and r.severity_class == "severe"
    assert any("AVA" in c for c in r.criteria_met)
    assert any("Mean gradient" in c for c in r.criteria_met)


def test_very_severe_when_velocity_above_5() -> None:
    r = assess_severity(
        patient(peak_aortic_velocity_m_per_s=5.2, mean_aortic_gradient_mmhg=62)
    )
    assert r.severity_class == "very_severe"
    assert r.is_severe


def test_low_flow_low_gradient() -> None:
    r = assess_severity(
        patient(
            lvef_pct=28,
            aortic_valve_area_cm2=0.8,
            mean_aortic_gradient_mmhg=28,
            peak_aortic_velocity_m_per_s=3.6,
        )
    )
    assert r.is_severe
    assert r.severity_class == "low_flow_low_gradient"


def test_moderate_AS_not_severe() -> None:
    r = assess_severity(
        patient(
            aortic_valve_area_cm2=1.4,
            mean_aortic_gradient_mmhg=22,
            peak_aortic_velocity_m_per_s=3.0,
        )
    )
    assert not r.is_severe
    assert r.severity_class == "moderate"


def test_only_velocity_criterion_still_severe() -> None:
    r = assess_severity(
        patient(
            aortic_valve_area_cm2=1.1,
            mean_aortic_gradient_mmhg=35,
            peak_aortic_velocity_m_per_s=4.2,
        )
    )
    assert r.is_severe
    assert r.severity_class == "severe"
