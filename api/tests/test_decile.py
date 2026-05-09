"""Tests for decile placement and Wilson CI."""

from __future__ import annotations

import pytest

from tavi_api.scoring.decile import _FALLBACK_BOUNDARIES, assign_decile, wilson_ci


def test_low_probability_decile_zero() -> None:
    assert assign_decile(0.005, _FALLBACK_BOUNDARIES) == 0


def test_high_probability_decile_nine() -> None:
    assert assign_decile(0.50, _FALLBACK_BOUNDARIES) == 9


def test_mid_probability_in_middle_decile() -> None:
    d = assign_decile(0.040, _FALLBACK_BOUNDARIES)
    assert 3 <= d <= 6


def test_boundary_value_assigned_correctly() -> None:
    # 0.030 is the 3rd boundary (index 3); strict-less-than → values == 0.030 fall into decile 4
    d = assign_decile(0.030, _FALLBACK_BOUNDARIES)
    assert d == 4
    # Just below the boundary stays in decile 3
    assert assign_decile(0.0299, _FALLBACK_BOUNDARIES) == 3


def test_assign_decile_rejects_wrong_boundary_count() -> None:
    with pytest.raises(ValueError):
        assign_decile(0.5, [0.1, 0.2, 0.3])


def test_wilson_ci_brackets_p() -> None:
    lo, hi = wilson_ci(0.05, 4000)
    assert lo <= 0.05 <= hi
    assert hi - lo < 0.05  # tight CI for n=4000


def test_wilson_ci_widens_with_low_n() -> None:
    _lo_big, hi_big = wilson_ci(0.05, 4000)
    _lo_small, hi_small = wilson_ci(0.05, 50)
    assert (hi_small - _lo_small) > (hi_big - _lo_big)
