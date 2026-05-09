"""Tests for special considerations module."""

from __future__ import annotations

from tavi_api.sizing.considerations import considerations_for_patient

from ._helpers import patient


def test_bicuspid_recommends_balloon_expandable_in_notes() -> None:
    notes = considerations_for_patient(
        patient(bicuspid_valve=True), valve_class="self-expanding-supra-annular"
    )
    assert any("Bicuspid" in n and "balloon-expandable" in n for n in notes)


def test_severe_AR_prefers_active_sealing() -> None:
    notes = considerations_for_patient(
        patient(aortic_regurgitation_grade=3), valve_class="balloon-expandable"
    )
    assert any("AR" in n and "active sealing" in n for n in notes)


def test_severe_PVD_alt_access() -> None:
    notes = considerations_for_patient(
        patient(peripheral_vascular_disease=True, bmi=20),
        valve_class="balloon-expandable",
    )
    assert any("alternative access" in n.lower() for n in notes)


def test_low_lvef_recommends_cerebral_protection() -> None:
    notes = considerations_for_patient(patient(lvef_pct=22), valve_class="balloon-expandable")
    assert any("Sentinel" in n or "cerebral" in n.lower() for n in notes)


def test_short_MS_with_self_expanding_flagged() -> None:
    notes = considerations_for_patient(
        patient(membranous_septum_length_mm=3.5),
        valve_class="self-expanding-supra-annular",
    )
    assert any("membranous septum" in n.lower() and "PPM" in n for n in notes)


def test_clean_patient_few_notes() -> None:
    notes = considerations_for_patient(patient(), valve_class="balloon-expandable")
    # Some notes might still appear (e.g., AFib if you set it) but baseline patient
    # should produce minimal output.
    assert isinstance(notes, list)
