import { COLORS, MODEL_COLORS, Plot, alpha, config, layout } from "@/lib/plot";
import {
  type ModelComparisonReport,
  VARIANT_COLORS,
  VARIANT_SHORT,
  servingVariant,
  useReport,
} from "@/lib/reports";
import { usePrediction } from "@/store/prediction";

/** STS-PROM per-decile observed / expected ratios from published TAVI registries,
 *  the same table api/src/tavi_api/scoring/recalibration.py applies. Each point
 *  is (decile midpoint, midpoint × O/E). */
const STS_OE = [
  { pred: 0.005, oe: 1.55 },
  { pred: 0.0125, oe: 1.42 },
  { pred: 0.0175, oe: 1.2 },
  { pred: 0.025, oe: 1.05 },
  { pred: 0.0375, oe: 0.95 },
  { pred: 0.0525, oe: 0.85 },
  { pred: 0.07, oe: 0.75 },
  { pred: 0.095, oe: 0.65 },
  { pred: 0.13, oe: 0.55 },
  { pred: 0.2, oe: 0.45 },
];

// v1 LightGBM's raw scores sit below 0.1% in most deciles (raw O/E 2.93), so
// its curve would be a vertical smear at the left edge; it is described in the
// caption instead of drawn.
const SHOWN = ["v3_stacking", "v4_tabpfn"];

const MIN = 0.001;
const MAX = 0.3;
const TICKS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
// y = x sampled densely: with a log x axis and a linear y axis, a two-point
// segment would be drawn straight on screen, which is not the identity line.
const IDENTITY = Array.from({ length: 80 }, (_, i) => MIN * (MAX / MIN) ** (i / 79));

/** Predicted against observed 30-day mortality, by decile of prediction.
 *
 *  The ML curves are the measured, uncalibrated (raw) scores on the held-out
 *  test set from model_comparison.json. They are the only held-out calibration
 *  evidence in the report: the post-isotonic figures there come from a
 *  calibrator fitted on that same test set, so they cannot show miscalibration
 *  and are not drawn. The x axis is logarithmic because raw v1 scores sit far
 *  below 1%. */
export function ModelCalibration() {
  const result = usePrediction((s) => s.result);
  const { data, error } = useReport<ModelComparisonReport>("/model_comparison.json");
  const serving = result ? servingVariant(result.primary_model_name) : null;
  const patient = result?.lgbm.raw_probability ?? null;

  const variants = (data?.variants ?? []).filter((v) => !v.skipped && SHOWN.includes(v.name));
  const clip = (v: number) => Math.min(MAX, Math.max(MIN, v));

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">How reliable the model is</p>
      <h3 className="card-title">Calibration: predicted against observed mortality</h3>
      <p className="text-xs text-gray-500 mt-1 mb-2 max-w-3xl">
        Each point is one decile of predictions on the held-out test set: average predicted risk
        against the share who died. On the dashed line, a 5% prediction means 5% died. STS-PROM drifts
        off the line in modern TAVI (from published registry ratios). The v3 and v4 curves are their
        raw, uncalibrated scores.
      </p>
      {error && <p className="text-xs text-rose-700">Model comparison unavailable ({error}).</p>}
      {data && (
        <div className="figure-plate px-1 pt-2">
          <Plot
            data={[
              {
                type: "scatter",
                mode: "lines",
                x: IDENTITY,
                y: IDENTITY,
                name: "Perfect calibration",
                line: { color: COLORS.neutral, dash: "dash", width: 1.2 },
                hoverinfo: "skip",
              },
              {
                type: "scatter",
                mode: "lines+markers",
                x: STS_OE.map((d) => d.pred),
                y: STS_OE.map((d) => d.pred * d.oe),
                name: "STS-PROM (published registry O/E)",
                marker: { color: MODEL_COLORS.stsRecal, size: 8, line: { color: "#ffffff", width: 1.5 } },
                line: { color: MODEL_COLORS.stsRecal, width: 2.5, dash: "dot" },
                hovertemplate: "Predicted %{x:.1%}<br>Observed %{y:.1%}<extra>STS-PROM</extra>",
              },
              ...variants.map((v) => ({
                type: "scatter" as const,
                mode: "lines+markers" as const,
                x: v.calibration_curve.map((p) => clip(p.pred_mean)),
                y: v.calibration_curve.map((p) => clip(p.actual_mortality)),
                name: `${VARIANT_SHORT[v.name] ?? v.name}, raw (O/E ${v.calibration_raw_o_over_e.toFixed(2)})${v.name === serving ? " · serving" : ""}`,
                marker: {
                  color: VARIANT_COLORS[v.name],
                  size: v.name === serving ? 11 : 8,
                  line: { color: "#ffffff", width: 1.5 },
                },
                line: { color: VARIANT_COLORS[v.name], width: v.name === serving ? 3 : 2 },
                customdata: v.calibration_curve.map((p) => p.n),
                hovertemplate: `Predicted %{x:.2%}<br>Observed %{y:.1%}<br>n = %{customdata}<extra>${VARIANT_SHORT[v.name] ?? v.name}</extra>`,
              })),
            ]}
            layout={layout({
              height: 400,
              xaxis: {
                type: "log",
                title: { text: "Average predicted 30-day mortality (decile)" },
                tickvals: TICKS,
                ticktext: TICKS.map((t) => `${+(t * 100).toFixed(1)}%`),
                range: [Math.log10(MIN), Math.log10(MAX)],
              },
              yaxis: {
                title: { text: "Observed 30-day mortality" },
                tickformat: ".0%",
                range: [0, 0.22],
              },
              legend: { orientation: "h", x: 0, y: -0.24 },
              shapes:
                patient != null
                  ? [
                      {
                        type: "line",
                        xref: "x",
                        yref: "paper",
                        x0: clip(patient),
                        x1: clip(patient),
                        y0: 0,
                        y1: 1,
                        line: { color: alpha(COLORS.ibm, 0.7), width: 2, dash: "dot" },
                      },
                    ]
                  : [],
              annotations:
                patient != null
                  ? [
                      {
                        x: Math.log10(clip(patient)),
                        y: 1,
                        xref: "x",
                        yref: "paper",
                        yanchor: "bottom",
                        text: `This patient ${(patient * 100).toFixed(1)}%`,
                        showarrow: false,
                        font: { color: COLORS.ibmDark, size: 11 },
                        bgcolor: "rgba(255,255,255,0.9)",
                      },
                    ]
                  : [],
            })}
            config={config("calibration-measured")}
            style={{ width: "100%" }}
          />
        </div>
      )}
      {data && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] leading-snug text-amber-900">
          {serving === "v1_lgbm_baseline" ? "The model serving this case, v1 LightGBM," : "v1 LightGBM"}{" "}
          has no curve here: its raw scores sit below 0.1% in most deciles (raw O/E{" "}
          {data.variants.find((v) => v.name === "v1_lgbm_baseline")?.calibration_raw_o_over_e.toFixed(2) ?? "n/a"}
          ), and the isotonic calibrator that corrects them was fitted on this same test set, so the
          report holds no held-out calibration curve for the probability the site displays.
        </p>
      )}
      <p className="text-[10px] text-gray-500 mt-2 leading-snug">
        Deciles hold about 100 patients each, so each observed rate rests on a handful of deaths.
        Source: <code>model_comparison.json</code> (raw curves) and the STS-PROM recalibration table.
      </p>
    </div>
  );
}
