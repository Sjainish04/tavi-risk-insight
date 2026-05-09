"""Risk score implementations.

- STS-PROM 2018 (SAVR-trained, miscalibrates in TAVI)
- EuroSCORE II (mixed cardiac surgery, also miscalibrates)
- ACC/STS TVT Registry (TAVI-native; Edwards 2016, used by ACC TAVR Risk Calculator)
- Era-aware recalibration of STS-PROM (Vemulapalli 2024 anchors)
- Severity confirmation (ACC/AHA 2020)
- Futility composite
- Procedural complications (VARC-3)
- Decile placement + Wilson CI
- Clinical-language SHAP drivers
"""

from tavi_api.scoring.complications import compute_complications
from tavi_api.scoring.decile import assign_decile, load_boundaries, wilson_ci
from tavi_api.scoring.drivers import to_clinical_drivers, top_modifiable
from tavi_api.scoring.euroscore2 import euroscore_ii
from tavi_api.scoring.futility import assess_futility
from tavi_api.scoring.recalibration import (
    is_miscalibration_zone,
    miscalibration_message,
    recalibrate_sts_prom,
)
from tavi_api.scoring.severity import assess_severity
from tavi_api.scoring.sts_prom import sts_prom_30day_mortality
from tavi_api.scoring.tvt import tvt_in_hospital_mortality

__all__ = [
    "sts_prom_30day_mortality",
    "euroscore_ii",
    "tvt_in_hospital_mortality",
    "recalibrate_sts_prom",
    "is_miscalibration_zone",
    "miscalibration_message",
    "assess_severity",
    "assess_futility",
    "compute_complications",
    "assign_decile",
    "load_boundaries",
    "wilson_ci",
    "to_clinical_drivers",
    "top_modifiable",
]
