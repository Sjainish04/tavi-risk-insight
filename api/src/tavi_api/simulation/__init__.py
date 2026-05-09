"""Per-device procedural simulation, FEops HEARTguide-inspired.

Given a patient and a base 30-day mortality estimate, returns predicted
complication rates for the contemporary FDA-cleared TAVI valve families.
The published per-device PPM and PVL baselines come from the trial cohorts
documented in `research/01-clinical-foundations.md`; CT-derived features
modulate the predictions when available.
"""

from tavi_api.simulation.per_device import simulate_devices

__all__ = ["simulate_devices"]
