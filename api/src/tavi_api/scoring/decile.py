"""Decile placement and 95% CI for the LightGBM probability.

The decile boundaries are computed once at training time on the OOF predictions
and persisted to `models/reference_deciles.json`. If the file is missing, we
fall back to a static set of boundaries derived from the synthetic-cohort
distribution (training on n=4000 with seed=42, base rate ≈ 4.8%).

CI: Wilson score interval at p with effective n equal to the training rows.
This is a heuristic (the real model uncertainty has many more sources than
binomial counting noise); the UI labels it as "approximate 95% CI".
"""

from __future__ import annotations

import json
import math
from pathlib import Path

# Static fallback decile boundaries (derived from the v1 synthetic LightGBM OOF
# distribution; regenerated whenever the reference cohort changes).
_FALLBACK_BOUNDARIES: list[float] = [
    0.014,
    0.020,
    0.025,
    0.030,
    0.038,
    0.046,
    0.058,
    0.075,
    0.105,
]


def load_boundaries(model_dir: str | Path = "models") -> list[float]:
    """Load decile boundaries from disk; fall back to static list if missing."""
    p = Path(model_dir) / "reference_deciles.json"
    if p.exists():
        try:
            data = json.loads(p.read_text())
            boundaries = data.get("boundaries", [])
            if isinstance(boundaries, list) and len(boundaries) == 9:
                return [float(x) for x in boundaries]
        except (OSError, ValueError, TypeError):
            pass
    return _FALLBACK_BOUNDARIES


def assign_decile(probability: float, boundaries: list[float]) -> int:
    """Assign 0..9 decile for a probability given 9 boundary values."""
    if len(boundaries) != 9:
        raise ValueError(f"expected 9 boundaries, got {len(boundaries)}")
    for i, b in enumerate(boundaries):
        if probability < b:
            return i
    return 9


def wilson_ci(p: float, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score 95% CI for a binomial proportion."""
    if n <= 0:
        return (max(0.0, p - 0.05), min(1.0, p + 0.05))
    z2 = z * z
    denom = 1 + z2 / n
    center = (p + z2 / (2 * n)) / denom
    margin = (z * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom
    return (max(0.0, round(center - margin, 4)), min(1.0, round(center + margin, 4)))
