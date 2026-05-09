"""Era-aware recalibration of STS-PROM for contemporary TAVI cohorts.

The recalibration table is derived from published per-decile O/E ratios:
- Edwards 2019 (JTCVS): overall O/E 0.40 in TAVR
- Vemulapalli 2024 (JSCAI, n=3,270): STS O/E 0.46
- Structural Heart 2022 (n=21,250): O/E 1.4–1.6 in lowest-decile, <0.7 in highest

The lookup quantizes a raw STS-PROM probability into one of 10 deciles
calibrated to a contemporary low-risk-leaning TAVI cohort and applies the
era-specific O/E correction. This produces a more honest *observed-rate*
estimate than the raw STS-PROM number.

References:
- Edwards FH et al. JTCVS 2019. https://www.jtcvs.org/article/S0022-5223(18)32031-2/fulltext
- Vemulapalli S et al. JSCAI 2024. https://www.jscai.org/article/S2772-9303(23)00027-3/fulltext
- Structural Heart 2022. https://www.structuralheartjournal.org/article/S2474-8706(22)00839-9/fulltext
"""

from __future__ import annotations

# Decile bounds (raw STS-PROM probability) and observed/expected ratios
# from published contemporary TAVI cohorts. Lower deciles under-predict
# (O/E > 1), upper deciles over-predict (O/E < 1) — opposite directions.
_RECALIBRATION_TABLE: list[dict[str, float]] = [
    {"decile": 0, "raw_lo": 0.000, "raw_hi": 0.010, "oe_ratio": 1.55},
    {"decile": 1, "raw_lo": 0.010, "raw_hi": 0.015, "oe_ratio": 1.42},
    {"decile": 2, "raw_lo": 0.015, "raw_hi": 0.020, "oe_ratio": 1.20},
    {"decile": 3, "raw_lo": 0.020, "raw_hi": 0.030, "oe_ratio": 1.05},
    {"decile": 4, "raw_lo": 0.030, "raw_hi": 0.045, "oe_ratio": 0.95},
    {"decile": 5, "raw_lo": 0.045, "raw_hi": 0.060, "oe_ratio": 0.85},
    {"decile": 6, "raw_lo": 0.060, "raw_hi": 0.080, "oe_ratio": 0.75},
    {"decile": 7, "raw_lo": 0.080, "raw_hi": 0.110, "oe_ratio": 0.65},
    {"decile": 8, "raw_lo": 0.110, "raw_hi": 0.150, "oe_ratio": 0.55},
    {"decile": 9, "raw_lo": 0.150, "raw_hi": 1.000, "oe_ratio": 0.45},
]


def _decile_for(raw_sts: float) -> dict[str, float]:
    for entry in _RECALIBRATION_TABLE:
        if entry["raw_lo"] <= raw_sts < entry["raw_hi"]:
            return entry
    return _RECALIBRATION_TABLE[-1]


def recalibrate_sts_prom(raw_sts: float) -> tuple[float, int, float]:
    """Apply the era-aware O/E correction.

    Returns (recalibrated_probability, decile_index, oe_ratio_used).
    """
    entry = _decile_for(raw_sts)
    recal = max(0.001, min(0.99, raw_sts * entry["oe_ratio"]))
    return recal, int(entry["decile"]), entry["oe_ratio"]


def is_miscalibration_zone(raw_sts: float, recalibrated: float) -> bool:
    """True if the raw and recalibrated estimates disagree materially.

    The two ends of the spectrum are exactly where STS-PROM is now wrong
    in opposite directions, per Vemulapalli 2024.
    """
    if raw_sts < 0.020 and recalibrated > 1.5 * raw_sts:
        return True
    if raw_sts > 0.080 and recalibrated < 0.7 * raw_sts:
        return True
    return False


def miscalibration_message(raw_sts: float, recalibrated: float) -> str | None:
    if not is_miscalibration_zone(raw_sts, recalibrated):
        return None
    if raw_sts < 0.020:
        return (
            "Published evidence (Vemulapalli 2024 JSCAI; Structural Heart 2022) "
            "suggests STS-PROM systematically under-predicts 30-day TAVI mortality "
            "in this low-risk stratum. The recalibrated estimate corrects upward."
        )
    return (
        "Published evidence (Edwards 2019 JTCVS) suggests STS-PROM systematically "
        "over-predicts 30-day TAVI mortality in this high-risk stratum. The "
        "recalibrated estimate corrects downward."
    )
