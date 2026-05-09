"""Per-device predicted complication rates.

This is a transparent, rule-based simulator inspired by FEops HEARTguide.
Real digital-twin tools run patient-specific finite-element simulation on
the segmented aortic root; ours combines published baseline rates with
CT-derived modifiers. Useful as a hackathon decision-support visualization,
not a substitute for FEops.

Baseline rates from VARC-3 contemporary literature
(`research/01-clinical-foundations.md`, table "Valve Types"):

| Family                             | 30-day PPM | Mod+ PVL |
| Balloon (SAPIEN 3 / Ultra)         |  6–10%     |  1–3%    |
| Self-expanding supra (Evolut)      | 12–17%     |  3–5%    |
| Self-expanding intra (Navitor)     | 13–19%     |  1–4%    |
"""

from __future__ import annotations

from dataclasses import dataclass

from tavi_api.schemas import DeviceSimulation, PatientInput


@dataclass(frozen=True)
class _Profile:
    valve: str
    valve_class: str  # one of the schema literals
    ppm_baseline: float
    pvl_baseline: float
    mort_adjust: float
    notes_static: tuple[str, ...]


_PROFILES: list[_Profile] = [
    _Profile(
        valve="Edwards SAPIEN 3 Ultra",
        valve_class="balloon-expandable",
        ppm_baseline=0.07,
        pvl_baseline=0.02,
        mort_adjust=1.00,
        notes_static=(
            "Intra-annular balloon-expandable; outer skirt reduces PVL.",
            "PARTNER 3 (low risk) and PARTNER 2 (intermediate) trial heritage.",
        ),
    ),
    _Profile(
        valve="Medtronic Evolut FX+",
        valve_class="self-expanding-supra-annular",
        ppm_baseline=0.13,
        pvl_baseline=0.04,
        mort_adjust=1.00,
        notes_static=(
            "Supra-annular self-expanding; lower residual gradients.",
            "Higher PPM rate due to deeper LVOT seating.",
        ),
    ),
    _Profile(
        valve="Abbott Navitor",
        valve_class="self-expanding-intra-annular",
        ppm_baseline=0.14,
        pvl_baseline=0.02,
        mort_adjust=1.05,
        notes_static=(
            "Intra-annular self-expanding with NaviSeal active sealing cuff.",
            "Approved Jan 2023 for high/extreme-risk patients.",
        ),
    ),
]


def simulate_devices(
    patient: PatientInput, mort_baseline: float
) -> list[DeviceSimulation]:
    """Return one DeviceSimulation per FDA-cleared TAVI family."""
    results: list[DeviceSimulation] = []
    has_ct = (
        patient.annular_area_mm2 is not None
        or patient.calcium_volume_au is not None
        or patient.membranous_septum_length_mm is not None
    )

    for prof in _PROFILES:
        ppm = prof.ppm_baseline
        pvl = prof.pvl_baseline
        mort = mort_baseline * prof.mort_adjust
        notes: list[str] = list(prof.notes_static)

        # CT-derived modifiers
        if patient.membranous_septum_length_mm is not None:
            ms = patient.membranous_septum_length_mm
            if ms < 5.0 and prof.valve_class.startswith("self-expanding"):
                ppm *= 1.5
                notes.append(
                    f"Membranous septum {ms:.1f} mm < 5 mm — elevated PPM risk for "
                    "self-expanding deployment."
                )
            elif ms < 5.0:
                ppm *= 1.2
                notes.append(
                    f"Membranous septum {ms:.1f} mm < 5 mm — modestly elevated PPM risk."
                )

        if patient.calcium_volume_au is not None and patient.calcium_volume_au > 1000:
            pvl *= 1.4
            notes.append(
                f"Calcium volume {patient.calcium_volume_au:.0f} AU — elevated PVL risk."
            )

        if (
            patient.distance_to_left_main_mm is not None
            and patient.distance_to_left_main_mm < 10
        ):
            mort *= 1.10
            notes.append(
                f"Left-main height {patient.distance_to_left_main_mm:.1f} mm < 10 mm — "
                "consider coronary protection."
            )

        # Clinical modifiers (used regardless of CT availability)
        if patient.lvef_pct < 30:
            mort *= 1.30

        if patient.atrial_fibrillation:
            ppm *= 1.05  # mild

        results.append(
            DeviceSimulation(
                valve=prof.valve,
                valve_class=prof.valve_class,  # type: ignore[arg-type]
                predicted_mortality_30d=round(min(mort, 0.50), 4),
                predicted_ppm_30d=round(min(ppm, 0.60), 4),
                predicted_pvl_moderate=round(min(pvl, 0.20), 4),
                notes=notes,
            )
        )

    if not has_ct:
        for r in results:
            r.notes.append(
                "CT-derived features not provided — predictions based on clinical "
                "variables and published baseline rates only."
            )

    return results
