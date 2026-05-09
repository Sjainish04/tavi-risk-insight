"""Coronary obstruction risk grading.

Combines anatomic measurements (coronary heights, sinus of Valsalva diameter)
with valve class to grade obstruction risk as low / intermediate / high.

Self-expanding supra-annular valves (Evolut family) are more risk-sensitive
because their leaflets sit higher in the sinus; thresholds shift up by 2 mm.

References:
- Ribeiro HB et al. JACC 2013;62(17):1552-62 — coronary obstruction predictors.
- Yamamoto M et al. Circ Cardiovasc Interv 2014;7(5):683-91 — pooled analysis.
- Lederman RJ et al. JACC Cardiovasc Interv 2019 — BASILICA for high-risk anatomy.
"""

from __future__ import annotations

from typing import Literal

from tavi_api.schemas import CoronaryObstructionRisk

ValveClass = Literal[
    "balloon-expandable",
    "self-expanding-supra-annular",
    "self-expanding-intra-annular",
]


def coronary_obstruction_risk(
    *,
    distance_to_left_main_mm: float | None,
    distance_to_right_coronary_mm: float | None,
    sinus_of_valsalva_diameter_mm: float | None,
    valve_class: ValveClass,
) -> CoronaryObstructionRisk:
    """Grade coronary obstruction risk.

    Risk grade:
    - high: LM < 10mm OR RCA < 11mm OR SoV < 28mm
    - intermediate: LM 10-12, RCA 11-12, or SoV 28-30 (any borderline)
    - low: all measurements above borderline thresholds

    Self-expanding supra-annular shifts each threshold up by 2 mm.
    """
    # Threshold shift for supra-annular valves (Evolut)
    shift = 2.0 if valve_class == "self-expanding-supra-annular" else 0.0

    lm_high = 10.0 + shift
    lm_inter = 12.0 + shift
    rca_high = 11.0 + shift
    rca_inter = 12.0 + shift
    sov_high = 28.0 + shift
    sov_inter = 30.0 + shift

    reasons: list[str] = []

    # Missing-data handling: if all three measurements are None, return intermediate
    # with a clear note (cannot rule out obstruction without CT).
    if all(
        v is None
        for v in (
            distance_to_left_main_mm,
            distance_to_right_coronary_mm,
            sinus_of_valsalva_diameter_mm,
        )
    ):
        return CoronaryObstructionRisk(
            grade="intermediate",
            reasons=["CT measurements not provided — cannot rule out obstruction risk."],
        )

    is_high = False
    is_intermediate = False

    if distance_to_left_main_mm is not None:
        if distance_to_left_main_mm < lm_high:
            is_high = True
            reasons.append(
                f"Left main height {distance_to_left_main_mm:.1f} mm < {lm_high:.0f} mm"
            )
        elif distance_to_left_main_mm < lm_inter:
            is_intermediate = True
            reasons.append(
                f"Left main height {distance_to_left_main_mm:.1f} mm (borderline)"
            )

    if distance_to_right_coronary_mm is not None:
        if distance_to_right_coronary_mm < rca_high:
            is_high = True
            reasons.append(
                f"Right coronary height {distance_to_right_coronary_mm:.1f} mm < {rca_high:.0f} mm"
            )
        elif distance_to_right_coronary_mm < rca_inter:
            is_intermediate = True
            reasons.append(
                f"Right coronary height {distance_to_right_coronary_mm:.1f} mm (borderline)"
            )

    if sinus_of_valsalva_diameter_mm is not None:
        if sinus_of_valsalva_diameter_mm < sov_high:
            is_high = True
            reasons.append(
                f"Sinus of Valsalva diameter {sinus_of_valsalva_diameter_mm:.1f} mm < {sov_high:.0f} mm"
            )
        elif sinus_of_valsalva_diameter_mm < sov_inter:
            is_intermediate = True
            reasons.append(
                f"Sinus of Valsalva diameter {sinus_of_valsalva_diameter_mm:.1f} mm (borderline)"
            )

    if valve_class == "self-expanding-supra-annular" and (is_high or is_intermediate):
        reasons.append(
            "Self-expanding supra-annular valve — leaflets sit higher in sinus; thresholds shifted +2 mm."
        )

    if is_high:
        return CoronaryObstructionRisk(grade="high", reasons=reasons)
    if is_intermediate:
        return CoronaryObstructionRisk(grade="intermediate", reasons=reasons)
    return CoronaryObstructionRisk(
        grade="low",
        reasons=[
            "Coronary heights and sinus dimensions adequate for safe deployment.",
        ],
    )
