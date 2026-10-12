import { MODEL_COLORS } from "@/lib/plot";
import { fmtPct } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

interface Estimate {
  label: string;
  p: number;
  color: string;
  ci?: [number, number];
}

/** Bands from `riskBand` in lib/utils: low < 4 %, intermediate < 8 %, high above. */
const LOW = 0.04;
const INTERMEDIATE = 0.08;

/** Every model's 30-day mortality estimate on one axis, over the risk bands.
 *
 *  The calculators disagree by design (different cohorts, different eras), and
 *  a row of separate numbers hides how much. One shared scale shows the spread
 *  and which band each estimate falls in. Values and colours come straight from
 *  the prediction; nothing here is computed beyond positioning. */
export function RiskBandScale({ compact = false }: { compact?: boolean }) {
  const result = usePrediction((s) => s.result);
  if (!result) return null;

  const stsRaw = result.sts_prom.raw_probability;
  const estimates: Estimate[] = [
    { label: "STS-PROM, raw", p: stsRaw, color: MODEL_COLORS.stsRaw },
    {
      label: "STS-PROM, recalibrated",
      p: result.sts_prom.recalibrated_probability ?? stsRaw,
      color: MODEL_COLORS.stsRecal,
    },
    { label: "ACC/STS TVT", p: result.tvt.raw_probability, color: MODEL_COLORS.tvt },
    { label: "EuroSCORE II", p: result.euroscore_ii.raw_probability, color: MODEL_COLORS.euroscore },
    {
      label: result.primary_model_name === "v3_stacking_brdav" ? "Stacking ensemble" : "LightGBM",
      p: result.lgbm.raw_probability,
      color: MODEL_COLORS.lgbm,
      ci: result.lgbm_ci,
    },
  ];

  // Axis wide enough for every estimate and interval, never narrower than 12 %.
  const top = Math.max(0.12, ...estimates.map((e) => (e.ci ? e.ci[1] : e.p))) * 1.1;
  const pct = (p: number) => Math.min(100, Math.max(0, (p / top) * 100));
  const at = (p: number) => `${pct(p)}%`;
  const ticks = [0, LOW, INTERMEDIATE, ...(top > 0.16 ? [0.15] : [])];
  const bands = [
    { label: "Low < 4%", mid: LOW / 2, className: "text-emerald-700" },
    { label: "Intermediate 4 to 8%", mid: (LOW + INTERMEDIATE) / 2, className: "text-amber-700" },
    { label: "High ≥ 8%", mid: (INTERMEDIATE + top) / 2, className: "text-rose-700" },
  ];

  return (
    <figure className="m-0">
      <div className={compact ? "px-2 pt-2" : "px-2 pt-3"}>
        <div className="relative h-3">
          {/* Bands and the ML interval, clipped to the rounded track */}
          <div className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-slate-200">
            <div className="absolute inset-y-0 left-0 bg-emerald-100" style={{ width: at(LOW) }} />
            <div
              className="absolute inset-y-0 bg-amber-100"
              style={{ left: at(LOW), width: `${pct(INTERMEDIATE) - pct(LOW)}%` }}
            />
            <div className="absolute inset-y-0 right-0 bg-rose-100" style={{ left: at(INTERMEDIATE) }} />
            {estimates
              .filter((e) => e.ci)
              .map((e) => (
                <div
                  key={`ci-${e.label}`}
                  className="absolute inset-y-0.5 origin-left rounded-full opacity-35 animate-grow-x"
                  style={{
                    left: at(e.ci![0]),
                    width: `${pct(e.ci![1]) - pct(e.ci![0])}%`,
                    background: e.color,
                  }}
                />
              ))}
          </div>
          {/* One marker per model, centred on the track */}
          {estimates.map((e) => (
            <span
              key={e.label}
              aria-hidden="true"
              title={`${e.label}: ${fmtPct(e.p)}`}
              className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-md transition-[left] duration-700"
              style={{ left: at(e.p), background: e.color }}
            />
          ))}
        </div>
        <div className="relative mt-1.5 h-4 font-mono text-[10px] text-gray-500">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: at(t) }}>
              {Math.round(t * 100)}%
            </span>
          ))}
        </div>
        {!compact && (
          <div className="relative h-4 text-[10px] font-semibold uppercase tracking-wider">
            {bands.map((b) => (
              <span
                key={b.label}
                className={`absolute -translate-x-1/2 whitespace-nowrap ${b.className}`}
                style={{ left: at(b.mid) }}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <figcaption className="mt-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-700">
          {estimates.map((e) => (
            <li key={e.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
              {e.label}
              <span className="font-mono font-semibold text-gray-900">{fmtPct(e.p)}</span>
              {e.ci && (
                <span className="font-mono text-gray-500">
                  ({fmtPct(e.ci[0])} to {fmtPct(e.ci[1])})
                </span>
              )}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
