"""Special considerations rule module.

Generates per-device clinical considerations based on patient anatomy,
comorbidities, and concomitant findings.

References:
- Yoon SH et al. JACC 2017;69(21):2579-89 — bicuspid AV outcomes by device class.
- Linke A et al. JACC Cardiovasc Interv 2020 — alternative-access TAVI.
- Toggweiler S et al. JACC Cardiovasc Interv 2018 — porcelain aorta.
- Kapadia SR et al. NEJM 2022 PROTECTED-TAVR — cerebral protection.
"""

from __future__ import annotations

from typing import Literal

from tavi_api.schemas import PatientInput

ValveClass = Literal[
    "balloon-expandable",
    "self-expanding-supra-annular",
    "self-expanding-intra-annular",
]


def considerations_for_patient(p: PatientInput, valve_class: ValveClass) -> list[str]:
    """Return clinical considerations for this patient × valve-class combination."""
    notes: list[str] = []

    # Bicuspid AV: literature supports balloon-expandable for type 1 BAV
    if p.bicuspid_valve and valve_class != "balloon-expandable":
        notes.append(
            "Bicuspid aortic valve — balloon-expandable (SAPIEN 3 Ultra) "
            "associated with lower PVL than self-expanding (Yoon 2017)."
        )
    elif p.bicuspid_valve:
        notes.append(
            "Bicuspid aortic valve — confirm Sievers type on CT before device selection."
        )

    # Severe concomitant AR: prefer active-sealing device
    if p.aortic_regurgitation_grade >= 2 and valve_class == "balloon-expandable":
        notes.append(
            "Concomitant moderate-or-greater AR — consider self-expanding with "
            "active sealing (Navitor / Evolut FX+) for improved sealing of regurgitant jet."
        )

    # Hostile iliofemoral access (PVD + low BMI is a proxy)
    if p.peripheral_vascular_disease and p.bmi < 22:
        notes.append(
            "Iliofemoral access likely hostile — consider alternative access "
            "(transaxillary / transcaval / direct aortic)."
        )
    elif p.peripheral_vascular_disease:
        notes.append(
            "Peripheral arterial disease — confirm transfemoral feasibility on CT angiogram."
        )

    # Prior CABG: coronary protection planning
    if p.prior_cabg:
        notes.append(
            "Prior CABG — review CT for patent grafts; plan coronary protection "
            "if low coronary heights."
        )

    # Reduced LVEF: cerebral protection consideration
    if p.lvef_pct < 30:
        notes.append(
            "Severely reduced LVEF — consider Sentinel cerebral embolic protection "
            "(PROTECTED-TAVR; benefit highest in disabling-stroke subgroup)."
        )

    # Frailty optimization
    if p.clinical_frailty_scale is not None and p.clinical_frailty_scale >= 6:
        notes.append(
            "Pre-procedural frailty optimization recommended (PT, nutrition, "
            "geriatric co-management)."
        )

    # COPD — anesthesia plan
    if p.chronic_lung_disease:
        notes.append(
            "COPD — consider conscious sedation over general anesthesia where access permits."
        )

    # Atrial fibrillation — anticoagulation strategy
    if p.atrial_fibrillation:
        notes.append(
            "Atrial fibrillation — confirm peri-procedural anticoagulation strategy "
            "(bridging vs DOAC continuation)."
        )

    # Prior pacemaker — conduction risk lower (already paced)
    if p.prior_pacemaker and valve_class.startswith("self-expanding"):
        notes.append(
            "Prior pacemaker in place — conduction-block concern reduced; "
            "self-expanding device acceptable."
        )

    # Heavy calcium — annular rupture risk with balloon-expandable
    if p.calcium_volume_au is not None and p.calcium_volume_au > 2000:
        if valve_class == "balloon-expandable":
            notes.append(
                f"Heavy aortic valve calcium ({p.calcium_volume_au:.0f} AU) — "
                "annular rupture risk with balloon-expandable; consider self-expanding."
            )
        else:
            notes.append(
                f"Heavy aortic valve calcium ({p.calcium_volume_au:.0f} AU) — "
                "elevated PVL risk; review distribution on CT."
            )

    # Short membranous septum — conduction risk especially for self-expanding
    if (
        p.membranous_septum_length_mm is not None
        and p.membranous_septum_length_mm < 5
        and valve_class.startswith("self-expanding")
    ):
        notes.append(
            f"Short membranous septum ({p.membranous_septum_length_mm:.1f} mm < 5) — "
            "elevated PPM risk with self-expanding deployment; high implant depth recommended."
        )

    return notes
