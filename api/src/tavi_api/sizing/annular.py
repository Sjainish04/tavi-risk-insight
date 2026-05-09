"""Per-device annular sizing for the three contemporary FDA-cleared TAVI families.

Tables are summarised manufacturer Instructions-For-Use (IFU); consult the full
IFU for clinical use. Real sizing also considers aortic angulation, calcium
distribution, BMI/access, and operator preference.

References:
- Edwards SAPIEN 3 Ultra IFU: https://www.edwards.com/devices/heart-valves/transcatheter
- Medtronic Evolut FX+ IFU (sized by perimeter): https://www.medtronic.com
- Abbott Navitor IFU: https://www.cardiovascular.abbott
"""

from __future__ import annotations

from typing import Literal

from tavi_api.schemas import AnnularSizing

DeviceKey = Literal["sapien_3_ultra", "evolut_fx_plus", "navitor"]
DEVICE_KEYS: tuple[DeviceKey, ...] = ("sapien_3_ultra", "evolut_fx_plus", "navitor")


# SAPIEN 3 Ultra — sized primarily by annular AREA (mm^2)
_SAPIEN_3_ULTRA: list[dict] = [
    {"size_mm": 20, "area_min": 273, "area_max": 345},
    {"size_mm": 23, "area_min": 338, "area_max": 430},
    {"size_mm": 26, "area_min": 430, "area_max": 546},
    {"size_mm": 29, "area_min": 540, "area_max": 680},
]

# Evolut FX+ — sized by annular PERIMETER (mm); area provided as a guide
_EVOLUT_FX_PLUS: list[dict] = [
    {"size_mm": 23, "perim_min": 56.5, "perim_max": 62.8, "area_min": 254, "area_max": 314},
    {"size_mm": 26, "perim_min": 62.8, "perim_max": 72.3, "area_min": 314, "area_max": 415},
    {"size_mm": 29, "perim_min": 72.3, "perim_max": 81.7, "area_min": 415, "area_max": 530},
    {"size_mm": 34, "perim_min": 81.7, "perim_max": 94.3, "area_min": 530, "area_max": 707},
]

# Navitor — sized by annular AREA (mm^2)
_NAVITOR: list[dict] = [
    {"size_mm": 23, "area_min": 283, "area_max": 346},
    {"size_mm": 25, "area_min": 346, "area_max": 415},
    {"size_mm": 27, "area_min": 415, "area_max": 491},
    {"size_mm": 29, "area_min": 491, "area_max": 572},
]


def _nominal_area(size_mm: int) -> float:
    """Approximate nominal area (mm^2) for a circular valve at its nominal diameter."""
    import math
    r = size_mm / 2.0
    return math.pi * r * r


def _pick_by_area(area: float, table: list[dict]) -> dict | None:
    for row in table:
        if row["area_min"] <= area <= row["area_max"]:
            return row
    return None


def _pick_evolut_by_perimeter(perimeter: float, table: list[dict]) -> dict | None:
    for row in table:
        if row["perim_min"] <= perimeter <= row["perim_max"]:
            return row
    return None


def _missing_ct(device_label: str) -> AnnularSizing:
    return AnnularSizing(
        recommended_size_mm=None,
        recommended_size_label=f"{device_label} — sizing pending",
        oversizing_pct=None,
        in_range=False,
        note="CT not available — sizing requires preprocedural CT (annular area + perimeter).",
    )


def _out_of_range(device_label: str, area: float | None, perim: float | None) -> AnnularSizing:
    measured = []
    if area is not None:
        measured.append(f"area {area:.0f} mm²")
    if perim is not None:
        measured.append(f"perimeter {perim:.1f} mm")
    measured_str = ", ".join(measured) or "n/a"
    return AnnularSizing(
        recommended_size_mm=None,
        recommended_size_label=f"{device_label} — annulus outside published range",
        oversizing_pct=None,
        in_range=False,
        note=f"Annulus ({measured_str}) outside published {device_label} sizing range — Heart Team review required.",
    )


def size_for_device(
    *,
    annular_area_mm2: float | None,
    annular_perimeter_mm: float | None,
    device: DeviceKey,
) -> AnnularSizing:
    """Recommend a valve size for the given annular dimensions.

    Returns AnnularSizing with `recommended_size_mm`, `oversizing_pct`, `in_range`,
    and a human-readable note. If CT is missing or annulus is out of range,
    `recommended_size_mm` is None.
    """
    if device == "sapien_3_ultra":
        device_label = "SAPIEN 3 Ultra"
        if annular_area_mm2 is None:
            return _missing_ct(device_label)
        row = _pick_by_area(annular_area_mm2, _SAPIEN_3_ULTRA)
        if row is None:
            return _out_of_range(device_label, annular_area_mm2, annular_perimeter_mm)
        nominal = _nominal_area(int(row["size_mm"]))
        oversizing = (nominal - annular_area_mm2) / annular_area_mm2 * 100.0
        return AnnularSizing(
            recommended_size_mm=int(row["size_mm"]),
            recommended_size_label=f"SAPIEN 3 Ultra {row['size_mm']} mm",
            oversizing_pct=round(oversizing, 1),
            in_range=True,
            note=(
                f"Sized by annular area ({annular_area_mm2:.0f} mm² ∈ "
                f"[{row['area_min']}, {row['area_max']}]). "
                f"Edwards target: 0–15% area oversizing."
            ),
        )

    if device == "evolut_fx_plus":
        device_label = "Evolut FX+"
        if annular_perimeter_mm is None:
            # Fall back to area if perimeter missing
            if annular_area_mm2 is None:
                return _missing_ct(device_label)
            row = _pick_by_area(annular_area_mm2, _EVOLUT_FX_PLUS)
            if row is None:
                return _out_of_range(device_label, annular_area_mm2, None)
            return AnnularSizing(
                recommended_size_mm=int(row["size_mm"]),
                recommended_size_label=f"Evolut FX+ {row['size_mm']} mm (area-based)",
                oversizing_pct=None,
                in_range=True,
                note=(
                    f"Sized by area approximation ({annular_area_mm2:.0f} mm²) — "
                    "perimeter measurement preferred for Evolut."
                ),
            )
        row = _pick_evolut_by_perimeter(annular_perimeter_mm, _EVOLUT_FX_PLUS)
        if row is None:
            return _out_of_range(device_label, annular_area_mm2, annular_perimeter_mm)
        nominal_perim = (row["perim_min"] + row["perim_max"]) / 2
        oversizing = (nominal_perim - annular_perimeter_mm) / annular_perimeter_mm * 100.0
        return AnnularSizing(
            recommended_size_mm=int(row["size_mm"]),
            recommended_size_label=f"Evolut FX+ {row['size_mm']} mm",
            oversizing_pct=round(oversizing, 1),
            in_range=True,
            note=(
                f"Sized by annular perimeter ({annular_perimeter_mm:.1f} mm ∈ "
                f"[{row['perim_min']:.1f}, {row['perim_max']:.1f}]). "
                f"Medtronic target: 10–25% perimeter oversizing."
            ),
        )

    if device == "navitor":
        device_label = "Navitor"
        if annular_area_mm2 is None:
            return _missing_ct(device_label)
        row = _pick_by_area(annular_area_mm2, _NAVITOR)
        if row is None:
            return _out_of_range(device_label, annular_area_mm2, annular_perimeter_mm)
        nominal = _nominal_area(int(row["size_mm"]))
        oversizing = (nominal - annular_area_mm2) / annular_area_mm2 * 100.0
        return AnnularSizing(
            recommended_size_mm=int(row["size_mm"]),
            recommended_size_label=f"Navitor {row['size_mm']} mm",
            oversizing_pct=round(oversizing, 1),
            in_range=True,
            note=(
                f"Sized by annular area ({annular_area_mm2:.0f} mm² ∈ "
                f"[{row['area_min']}, {row['area_max']}]). "
                f"Abbott NaviSeal active sealing supports moderate oversizing."
            ),
        )

    raise ValueError(f"unknown device: {device}")
