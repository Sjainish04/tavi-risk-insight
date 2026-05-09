"""Tests for the clinical-language driver renderer."""

from __future__ import annotations

from tavi_api.schemas import ShapContribution
from tavi_api.scoring.drivers import to_clinical_drivers, top_modifiable


def _shap(feature: str, value, shap_value: float) -> ShapContribution:
    return ShapContribution(
        feature=feature,
        value=value,
        shap_value=shap_value,
        direction="increases" if shap_value > 0 else "decreases",
    )


def test_albumin_renders_with_units_and_modifiable() -> None:
    drivers = to_clinical_drivers([_shap("albumin_g_dl", 2.9, 0.18)])
    d = drivers[0]
    assert "Albumin" in d.feature_label
    assert "2.9" in d.feature_label
    assert "g/dL" in d.feature_label
    assert d.is_modifiable
    assert d.effect == "increases"
    assert d.modify_to is not None and "3.5" in d.modify_to


def test_age_not_modifiable() -> None:
    drivers = to_clinical_drivers([_shap("age_years", 88.0, 0.22)])
    assert not drivers[0].is_modifiable


def test_boolean_feature_renders_yes_no() -> None:
    drivers = to_clinical_drivers([_shap("on_dialysis", True, 0.31)])
    assert "yes" in drivers[0].current_value
    assert "On dialysis" in drivers[0].feature_label


def test_top_modifiable_returns_highest_impact() -> None:
    drivers = to_clinical_drivers(
        [
            _shap("age_years", 88.0, 0.22),
            _shap("albumin_g_dl", 2.9, 0.18),
            _shap("hemoglobin_g_dl", 10.0, 0.06),
        ]
    )
    top = top_modifiable(drivers)
    assert top is not None
    assert top.raw_feature_name == "albumin_g_dl"


def test_top_modifiable_none_when_no_modifiables() -> None:
    drivers = to_clinical_drivers([_shap("age_years", 88.0, 0.22)])
    assert top_modifiable(drivers) is None


def test_dict_input_also_works() -> None:
    drivers = to_clinical_drivers(
        [{"feature": "lvef_pct", "value": 28.0, "shap_value": 0.12, "direction": "increases"}]
    )
    assert drivers[0].raw_feature_name == "lvef_pct"
    assert drivers[0].magnitude_pp > 0
