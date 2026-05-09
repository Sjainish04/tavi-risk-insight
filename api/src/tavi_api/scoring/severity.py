"""Aortic-stenosis severity confirmation per ACC/AHA 2020 Valve Guideline.

Severity criteria (any one confirms severe AS):
- Aortic valve area (AVA) < 1.0 cm^2
- Mean transaortic gradient >= 40 mmHg
- Peak aortic jet velocity >= 4.0 m/s

Very severe AS (any one):
- Mean gradient >= 60 mmHg
- Peak velocity >= 5.0 m/s

Low-flow / low-gradient severe AS (classical):
- LVEF < 50% AND mean gradient < 40 mmHg AND AVA < 1.0 cm^2

Reference:
- Otto CM et al. 2020 ACC/AHA Guideline for the Management of Patients With
  Valvular Heart Disease. JACC 77(4):e25-e197.
"""

from __future__ import annotations

from tavi_api.schemas import PatientInput, SeverityAssessment


def assess_severity(p: PatientInput) -> SeverityAssessment:
    """Confirm aortic stenosis severity from echo measurements."""
    ava = p.aortic_valve_area_cm2
    mg = p.mean_aortic_gradient_mmhg
    pv = p.peak_aortic_velocity_m_per_s
    ef = p.lvef_pct

    criteria_met: list[str] = []
    if ava < 1.0:
        criteria_met.append(f"AVA < 1.0 cm² (measured {ava:.2f})")
    if mg >= 40:
        criteria_met.append(f"Mean gradient ≥ 40 mmHg (measured {mg:.0f})")
    if pv >= 4.0:
        criteria_met.append(f"Peak velocity ≥ 4.0 m/s (measured {pv:.1f})")

    is_severe = len(criteria_met) > 0

    # Very severe takes precedence over severe
    if mg >= 60 or pv >= 5.0:
        return SeverityAssessment(
            is_severe=True,
            severity_class="very_severe",
            criteria_met=criteria_met,
            notes=(
                "Very severe AS — mean gradient ≥ 60 mmHg or peak velocity ≥ 5.0 m/s. "
                "Symptomatic patients have Class I indication for valve replacement."
            ),
        )

    # Low-flow low-gradient severe AS (classical, reduced EF)
    if ef < 50 and mg < 40 and ava < 1.0:
        return SeverityAssessment(
            is_severe=True,
            severity_class="low_flow_low_gradient",
            criteria_met=criteria_met
            + [f"LVEF < 50% (measured {ef:.0f}%) with AVA < 1.0 cm² and gradient < 40 mmHg"],
            notes=(
                "Classical low-flow low-gradient severe AS. Consider dobutamine stress echo "
                "to differentiate true-severe from pseudo-severe AS before TAVI."
            ),
        )

    if is_severe:
        return SeverityAssessment(
            is_severe=True,
            severity_class="severe",
            criteria_met=criteria_met,
            notes=None,
        )

    # Not severe — classify roughly as moderate vs not_severe
    if ava < 1.5 or mg >= 20 or pv >= 3.0:
        return SeverityAssessment(
            is_severe=False,
            severity_class="moderate",
            criteria_met=[],
            notes="Moderate AS — TAVI not indicated by current guideline criteria.",
        )

    return SeverityAssessment(
        is_severe=False,
        severity_class="not_severe",
        criteria_met=[],
        notes="Mild or no AS — re-evaluate echo findings.",
    )
