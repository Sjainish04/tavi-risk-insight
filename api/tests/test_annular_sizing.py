"""Tests for per-device annular sizing."""

from __future__ import annotations

from tavi_api.sizing.annular import size_for_device


def test_sapien3_pick_for_500mm2_annulus() -> None:
    r = size_for_device(annular_area_mm2=500, annular_perimeter_mm=82, device="sapien_3_ultra")
    assert r.recommended_size_mm == 26
    assert r.in_range
    assert r.oversizing_pct is not None


def test_sapien3_picks_29mm_for_large_annulus() -> None:
    r = size_for_device(annular_area_mm2=600, annular_perimeter_mm=88, device="sapien_3_ultra")
    assert r.recommended_size_mm == 29
    assert r.in_range


def test_oversize_annulus_out_of_range_for_navitor() -> None:
    r = size_for_device(annular_area_mm2=720, annular_perimeter_mm=99, device="navitor")
    assert not r.in_range
    assert r.recommended_size_mm is None


def test_missing_ct_returns_unsized() -> None:
    r = size_for_device(annular_area_mm2=None, annular_perimeter_mm=None, device="evolut_fx_plus")
    assert r.recommended_size_mm is None
    assert "CT not available" in r.note


def test_evolut_picks_29mm_by_perimeter() -> None:
    # Perimeter ~78 mm corresponds to Evolut 29 mm
    r = size_for_device(annular_area_mm2=480, annular_perimeter_mm=78, device="evolut_fx_plus")
    assert r.recommended_size_mm == 29
    assert r.in_range


def test_navitor_picks_25mm_for_400mm2() -> None:
    r = size_for_device(annular_area_mm2=400, annular_perimeter_mm=72, device="navitor")
    assert r.recommended_size_mm == 25
    assert r.in_range
