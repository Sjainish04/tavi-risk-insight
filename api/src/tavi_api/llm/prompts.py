"""Prompt templates for the explanation and safety-filter layers."""

from __future__ import annotations

EXPLANATION_SYSTEM_PROMPT = """\
You are a clinical-decision-support assistant for a TAVI Heart Team.

OUTPUT FORMAT — strict:
You MUST respond with exactly four bullet lines and nothing else. No \
introduction. No conclusion. No prose paragraphs. No greetings. \
Each bullet must be one sentence and start with "- ".

Bullet 1 (label "Clinical risk picture:"): one sentence summarizing where the \
patient sits on the risk spectrum, including AS severity class.
Bullet 2 (label "Calibration caveat:"): one sentence flagging any disagreement \
between the raw and recalibrated risk estimates.
Bullet 3 (label "Procedural complication highlight:"): one sentence calling out \
the most elevated procedural complication risk (e.g., stroke, AKI, vascular, bleed).
Bullet 4 (label "Heart Team consideration:"): one sentence on what additional \
information (imaging, frailty, anatomy) or modifiable factor would refine the assessment.

Do NOT give a treatment recommendation. Do NOT recommend a specific valve. \
Do NOT add a fifth bullet. Do NOT write a summary paragraph. Do NOT invent \
features not provided. Stop after the fourth bullet. Final decision rests \
with the Heart Team.\
"""


def build_explanation_user_prompt(
    *,
    features: dict,
    sts_prom_raw: float,
    sts_prom_recalibrated: float,
    euroscore_ii: float,
    tvt: float,
    lgbm_probability: float,
    shap_top5: list[dict],
    miscalibration_zone: bool,
    severity_class: str | None = None,
    futility_flag: bool = False,
    complication_top: list[str] | None = None,
    device_pick_reason: str | None = None,
    top_modifiable_driver: str | None = None,
) -> str:
    shap_lines = "\n".join(
        f"- {s['feature']} = {s['value']} → {s['direction']} risk "
        f"(SHAP {s['shap_value']:+.3f})"
        for s in shap_top5
    )
    severity_line = (
        f"AS severity: {severity_class}" if severity_class else "AS severity: not assessed"
    )
    futility_line = (
        "Futility flag: RAISED — medical therapy is the alternative."
        if futility_flag
        else "Futility flag: not raised."
    )
    complications_line = (
        "Top elevated complications: " + ", ".join(complication_top)
        if complication_top
        else "Top elevated complications: none above 1.5× base."
    )
    device_line = (
        f"Lowest-risk device candidate: {device_pick_reason}"
        if device_pick_reason
        else ""
    )
    modifiable_line = (
        f"Top modifiable driver: {top_modifiable_driver}"
        if top_modifiable_driver
        else "Top modifiable driver: none identified."
    )
    return f"""\
Patient features:
{features}

{severity_line}
{futility_line}

Risk estimates (30-day all-cause mortality):
- Raw STS-PROM: {sts_prom_raw * 100:.1f}% (SAVR-trained, miscalibrates in TAVI)
- Era-recalibrated STS-PROM: {sts_prom_recalibrated * 100:.1f}%
- EuroSCORE II (in-hospital): {euroscore_ii * 100:.1f}%
- ACC/STS TVT Registry (Edwards 2016, TAVI-native): {tvt * 100:.1f}%
- LightGBM (synthetic cohort, CT-aware): {lgbm_probability * 100:.1f}%

Top SHAP contributors:
{shap_lines}

{complications_line}
{device_line}
{modifiable_line}

Miscalibration zone flagged: {miscalibration_zone}\
"""
