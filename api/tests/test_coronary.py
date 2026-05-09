"""Tests for coronary obstruction risk grading."""

from __future__ import annotations

from tavi_api.sizing.coronary import coronary_obstruction_risk


def test_normal_anatomy_low_risk() -> None:
    r = coronary_obstruction_risk(
        distance_to_left_main_mm=14,
        distance_to_right_coronary_mm=14,
        sinus_of_valsalva_diameter_mm=33,
        valve_class="balloon-expandable",
    )
    assert r.grade == "low"


def test_low_LM_high_risk() -> None:
    r = coronary_obstruction_risk(
        distance_to_left_main_mm=8,
        distance_to_right_coronary_mm=12,
        sinus_of_valsalva_diameter_mm=30,
        valve_class="balloon-expandable",
    )
    assert r.grade == "high"
    assert any("Left main" in s for s in r.reasons)


def test_borderline_LM_intermediate() -> None:
    r = coronary_obstruction_risk(
        distance_to_left_main_mm=11,
        distance_to_right_coronary_mm=13,
        sinus_of_valsalva_diameter_mm=32,
        valve_class="balloon-expandable",
    )
    assert r.grade == "intermediate"


def test_self_expanding_supra_more_sensitive() -> None:
    args = dict(
        distance_to_left_main_mm=10,
        distance_to_right_coronary_mm=11,
        sinus_of_valsalva_diameter_mm=29,
    )
    be = coronary_obstruction_risk(valve_class="balloon-expandable", **args)
    sa = coronary_obstruction_risk(valve_class="self-expanding-supra-annular", **args)
    # Supra-annular is more risk-sensitive (thresholds shifted up)
    assert sa.grade in ("intermediate", "high")
    assert be.grade in ("low", "intermediate")


def test_missing_data_returns_intermediate() -> None:
    r = coronary_obstruction_risk(
        distance_to_left_main_mm=None,
        distance_to_right_coronary_mm=None,
        sinus_of_valsalva_diameter_mm=None,
        valve_class="balloon-expandable",
    )
    assert r.grade == "intermediate"
    assert any("CT measurements" in s for s in r.reasons)


def test_low_sov_high_risk() -> None:
    r = coronary_obstruction_risk(
        distance_to_left_main_mm=14,
        distance_to_right_coronary_mm=14,
        sinus_of_valsalva_diameter_mm=26,
        valve_class="balloon-expandable",
    )
    assert r.grade == "high"
    assert any("Sinus" in s for s in r.reasons)
