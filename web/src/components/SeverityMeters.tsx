import { usePrediction } from "@/store/prediction";

interface Zone {
  to: number;
  label: string;
  className: string;
}

interface Meter {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** AVA is worse when smaller, so its axis runs right to left. */
  reversed?: boolean;
  zones: Zone[];
  rule: string;
}

/** Cut-offs match api/src/tavi_api/scoring/severity.py (ACC/AHA 2020): AVA
 *  < 1.0 cm² severe and < 1.5 moderate; mean gradient ≥ 40 severe, ≥ 60 very
 *  severe, ≥ 20 moderate; peak velocity ≥ 4.0 severe, ≥ 5.0 very severe, ≥ 3.0
 *  moderate. Zones are listed from the mild end. */
const METERS: Meter[] = [
  {
    key: "aortic_valve_area_cm2",
    label: "Aortic valve area",
    unit: "cm²",
    min: 0.4,
    max: 2.0,
    reversed: true,
    rule: "Severe below 1.0 cm²",
    zones: [
      { to: 1.5, label: "Mild", className: "bg-slate-100" },
      { to: 1.0, label: "Moderate", className: "bg-amber-100" },
      { to: 0.4, label: "Severe", className: "bg-rose-200" },
    ],
  },
  {
    key: "mean_aortic_gradient_mmhg",
    label: "Mean gradient",
    unit: "mmHg",
    min: 0,
    max: 80,
    rule: "Severe from 40, very severe from 60 mmHg",
    zones: [
      { to: 20, label: "Mild", className: "bg-slate-100" },
      { to: 40, label: "Moderate", className: "bg-amber-100" },
      { to: 60, label: "Severe", className: "bg-rose-200" },
      { to: 80, label: "Very severe", className: "bg-rose-300" },
    ],
  },
  {
    key: "peak_aortic_velocity_m_per_s",
    label: "Peak velocity",
    unit: "m/s",
    min: 2,
    max: 6,
    rule: "Severe from 4.0, very severe from 5.0 m/s",
    zones: [
      { to: 3, label: "Mild", className: "bg-slate-100" },
      { to: 4, label: "Moderate", className: "bg-amber-100" },
      { to: 5, label: "Severe", className: "bg-rose-200" },
      { to: 6, label: "Very severe", className: "bg-rose-300" },
    ],
  },
];

function position(meter: Meter, value: number): number {
  const clamped = Math.min(meter.max, Math.max(meter.min, value));
  const share = (clamped - meter.min) / (meter.max - meter.min);
  return (meter.reversed ? 1 - share : share) * 100;
}

/** The three echo criteria as threshold meters: where this patient's
 *  measurement sits against the guideline cut-offs, severity rising to the right. */
export function SeverityMeters() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {METERS.map((meter) => {
        const raw = Number(result.feature_summary[meter.key]);
        if (!Number.isFinite(raw)) return null;
        let previous = meter.reversed ? meter.max : meter.min;
        const segments = meter.zones.map((zone) => {
          const start = position(meter, previous);
          const end = position(meter, zone.to);
          previous = zone.to;
          return { ...zone, left: Math.min(start, end), width: Math.abs(end - start) };
        });
        const marker = position(meter, raw);
        // Classified from the value, not the marker, so a reading exactly on a
        // cut-off lands in the same zone the backend puts it in.
        const current =
          meter.zones.find((z) => (meter.reversed ? raw >= z.to : raw < z.to)) ??
          meter.zones[meter.zones.length - 1];
        return (
          <figure key={meter.key} className="ibm-card m-0 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <figcaption className="text-xs font-semibold text-gray-700">{meter.label}</figcaption>
              <span className="font-mono text-lg font-semibold text-gray-900">
                {raw.toFixed(meter.unit === "mmHg" ? 0 : 2)}
                <span className="ml-1 text-[11px] font-normal text-gray-500">{meter.unit}</span>
              </span>
            </div>
            <div className="relative mt-3 h-3">
              <div className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-slate-200">
                {segments.map((s) => (
                  <div
                    key={s.label}
                    className={`absolute inset-y-0 ${s.className}`}
                    style={{ left: `${s.left}%`, width: `${s.width}%` }}
                  />
                ))}
              </div>
              <span
                aria-hidden="true"
                className="absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-white bg-ink-800 shadow-md"
                style={{ left: `${marker}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-gray-500">
              <span>{meter.reversed ? "Larger" : "Lower"}</span>
              <span className="font-semibold text-gray-700">{current.label}</span>
              <span>More severe</span>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">{meter.rule}</p>
          </figure>
        );
      })}
    </div>
  );
}
