import { COLORS, MODEL_COLORS, Plot, alpha, config, layout } from "@/lib/plot";
import { type CohortReport, useReport } from "@/lib/reports";
import { usePrediction } from "@/store/prediction";

const TICKS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
const tickText = TICKS.map((t) => `${+(t * 100).toFixed(1)}%`);

/** "1st", "2nd", "23rd", "11th". */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Share of the sample strictly below a value, as a whole percent. */
function percentile(values: number[], v: number): number {
  if (values.length === 0) return 0;
  return Math.round((values.filter((x) => x < v).length / values.length) * 100);
}

/** This patient against the 500-patient sample of the synthetic training cohort
 *  saved by api/scripts/analyze_brdav_vs_recal.py: recalibrated STS-PROM on one
 *  axis, the LightGBM 30-day prediction on the other, deaths marked. Both axes
 *  are logarithmic, because risks run from a fraction of a percent to tens. */
export function CohortPosition() {
  const result = usePrediction((s) => s.result);
  const { data, error } = useReport<CohortReport>("/brdav_vs_recal.json");
  if (!result) return null;

  const stsRecal = result.sts_prom.recalibrated_probability ?? result.sts_prom.raw_probability;
  const ml = result.lgbm.raw_probability;
  const servesV3 = result.primary_model_name.startsWith("v3");

  const sample = data?.scatter_sample ?? [];
  const floor = 0.001;
  const clip = (v: number) => Math.max(floor, v);
  const survivors = sample.filter((d) => d.outcome_30d_mortality === 0);
  const deaths = sample.filter((d) => d.outcome_30d_mortality === 1);
  const mlRank = percentile(sample.map((d) => d.lgbm_30d), ml);
  const stsRank = percentile(sample.map((d) => d.sts_recal), stsRecal);

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">Where this patient sits</p>
      <h3 className="card-title">This patient among the training cohort</h3>
      <p className="text-xs text-gray-500 mt-1 mb-2 max-w-3xl">
        {sample.length > 0 ? sample.length.toLocaleString() : "A sample of"} patients from the{" "}
        {data ? `${data.n_patients.toLocaleString()}-patient` : ""} synthetic cohort. Each dot is one
        patient; rose dots died within 30 days. Points on the dashed line are where the two scores
        agree.
      </p>

      {error && <p className="text-xs text-rose-700">Cohort sample unavailable ({error}).</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-3">
            <Stat
              label="ML risk percentile"
              value={ordinal(mlRank)}
              hint={`higher than ${mlRank}% of the sample`}
              color={MODEL_COLORS.lgbm}
            />
            <Stat
              label="STS-PROM percentile"
              value={ordinal(stsRank)}
              hint={`higher than ${stsRank}% of the sample`}
              color={MODEL_COLORS.stsRecal}
            />
            <Stat
              label="Cohort 30-day mortality"
              value={`${(data.outcome_30d_mortality_observed * 100).toFixed(1)}%`}
              hint={`observed in all ${data.n_patients.toLocaleString()} patients`}
              color={COLORS.increases}
            />
          </div>
          <div className="figure-plate px-1 pt-2">
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "lines",
                  x: [floor, 0.6],
                  y: [floor, 0.6],
                  line: { color: COLORS.neutral, dash: "dash", width: 1 },
                  hoverinfo: "skip",
                  showlegend: false,
                },
                {
                  type: "scatter",
                  mode: "markers",
                  name: `Survived 30 days (${survivors.length})`,
                  x: survivors.map((d) => clip(d.sts_recal)),
                  y: survivors.map((d) => clip(d.lgbm_30d)),
                  marker: { color: alpha(COLORS.muted, 0.35), size: 6, line: { width: 0 } },
                  hovertemplate: "STS-PROM %{x:.1%}<br>ML %{y:.1%}<extra>survived</extra>",
                },
                {
                  type: "scatter",
                  mode: "markers",
                  name: `Died within 30 days (${deaths.length})`,
                  x: deaths.map((d) => clip(d.sts_recal)),
                  y: deaths.map((d) => clip(d.lgbm_30d)),
                  marker: {
                    color: alpha(COLORS.increases, 0.85),
                    size: 9,
                    line: { color: "#ffffff", width: 1 },
                  },
                  hovertemplate: "STS-PROM %{x:.1%}<br>ML %{y:.1%}<extra>died</extra>",
                },
                {
                  type: "scatter",
                  mode: "markers",
                  name: "This patient",
                  x: [clip(stsRecal)],
                  y: [clip(ml)],
                  marker: {
                    color: COLORS.ibm,
                    size: 20,
                    symbol: "star",
                    line: { color: "#ffffff", width: 2 },
                  },
                  hovertemplate: "<b>This patient</b><br>STS-PROM %{x:.1%}<br>ML %{y:.1%}<extra></extra>",
                },
              ]}
              layout={layout({
                height: 400,
                xaxis: {
                  type: "log",
                  title: { text: "Recalibrated STS-PROM (30-day)" },
                  tickvals: TICKS,
                  ticktext: tickText,
                  range: [Math.log10(floor), Math.log10(0.6)],
                },
                yaxis: {
                  type: "log",
                  title: { text: servesV3 ? "LightGBM 30-day risk (cohort scale)" : "LightGBM 30-day risk" },
                  tickvals: TICKS,
                  ticktext: tickText,
                  range: [Math.log10(floor), Math.log10(0.6)],
                },
                annotations: [
                  {
                    x: Math.log10(clip(stsRecal)),
                    y: Math.log10(clip(ml)),
                    ax: 44,
                    ay: -34,
                    text: "This patient",
                    arrowcolor: COLORS.ibm,
                    arrowwidth: 1.2,
                    font: { color: COLORS.ibmDark, size: 11 },
                    bgcolor: "rgba(255,255,255,0.9)",
                  },
                ],
              })}
              config={config("cohort-position")}
              style={{ width: "100%" }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-2 leading-snug">
            Values below 0.1% are drawn at 0.1%. Source: <code>brdav_vs_recal.json</code>, the
            sample saved by <code>api/scripts/analyze_brdav_vs_recal.py</code>.
            {servesV3 &&
              " The API is serving the v3 stacking ensemble for this case, while the cohort's ML axis is LightGBM, so the patient's vertical position is indicative only."}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-semibold text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500">{hint}</div>
    </div>
  );
}
