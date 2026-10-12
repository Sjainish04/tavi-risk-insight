import { ArrowRight } from "lucide-react";

import { COLORS, Plot, alpha, config, layout, useNarrow } from "@/lib/plot";
import { fmtShap } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

/** The largest drivers of this patient's prediction, each as an approximate
 *  impact in percentage points (SHAP times the logistic working-point slope, as
 *  the API reports it).
 *
 *  Drawn as separate bars, not as a waterfall from the base rate: these impacts
 *  are not additive. Stacked from the 3 % base they can run below zero and leave
 *  a remainder as large as the biggest driver, so a cumulative chart would
 *  misstate how the prediction is composed. Their sum is shown beside the actual
 *  change so the gap stays visible. */
export function RiskDrivers() {
  const result = usePrediction((s) => s.result);
  const narrow = useNarrow();
  if (!result) return null;

  const p = result.lgbm.raw_probability * 100;
  const multiplier = result.lgbm_base_rate_comparison;
  const base = multiplier > 0 ? p / multiplier : p;
  const modelName = result.primary_model_name.startsWith("v3") ? "Stacking ensemble" : "LightGBM";

  // Largest effect at the top: Plotly draws horizontal categories bottom-up.
  const drivers = [...result.risk_score_drivers].sort((a, b) => a.magnitude_pp - b.magnitude_pp);
  if (drivers.length === 0) return null;
  const signed = drivers.map((d) => (d.effect === "increases" ? d.magnitude_pp : -d.magnitude_pp));
  const sum = signed.reduce((a, b) => a + b, 0);
  const colorOf = (d: (typeof drivers)[number]) =>
    d.is_modifiable && d.effect === "increases"
      ? COLORS.modifiable
      : d.effect === "increases"
        ? COLORS.increases
        : COLORS.decreases;
  // Room beyond the longest bar for its value label; more on a phone, where the
  // plot is narrow and a label on a leftward bar would otherwise reach the axis.
  const limit = Math.max(...drivers.map((d) => d.magnitude_pp)) * (narrow ? 2.3 : 1.35);

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">Why this risk</p>
      <h3 className="card-title">What moves this patient&apos;s risk</h3>

      <div className="mt-2 mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
          Cohort base rate <span className="font-mono font-semibold">{base.toFixed(1)}%</span>
        </span>
        <ArrowRight className="h-4 w-4 text-gray-400" />
        <span className="rounded-lg border border-ibm-200 bg-ibm-50 px-3 py-1.5 text-ibm-800">
          {modelName} for this patient <span className="font-mono font-semibold">{p.toFixed(1)}%</span>
        </span>
        <span className="text-xs text-gray-500">
          change {p - base >= 0 ? "+" : "−"}
          {Math.abs(p - base).toFixed(1)} pp; listed impacts sum to {sum >= 0 ? "+" : "−"}
          {Math.abs(sum).toFixed(1)} pp
        </span>
      </div>

      <div className="figure-plate px-1 pt-2">
        <Plot
          data={[
            {
              type: "bar",
              orientation: "h",
              x: signed,
              // On a phone, just the feature name ("eGFR", not "eGFR 55.0 mL/min/1.73m²");
              // the value stays in the tooltip.
              y: drivers.map((d) => (narrow ? d.feature_label.replace(/\s[\d.].*$/, "") : d.feature_label)),
              marker: {
                color: drivers.map((d) => alpha(colorOf(d), 0.85)),
                line: { color: drivers.map(colorOf), width: 1.5 },
              },
              text: signed.map((v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} pp`),
              textposition: "outside",
              textfont: { family: "ui-monospace, Menlo, monospace", size: 11, color: COLORS.ink },
              cliponaxis: false,
              customdata: drivers.map((d) =>
                d.is_modifiable && d.modify_to ? `modifiable, target ${d.modify_to}` : d.is_modifiable ? "modifiable" : "",
              ),
              hovertext: drivers.map((d) => d.feature_label),
              hovertemplate: "<b>%{hovertext}</b><br>impact %{text}<br>%{customdata}<extra></extra>",
            },
          ]}
          layout={layout({
            height: Math.max(230, 80 + drivers.length * 44),
            margin: { l: 12, r: 24, t: 8, b: 48 },
            bargap: 0.35,
            showlegend: false,
            xaxis: {
              title: {
                text: narrow ? "Impact (pp)" : "Approximate impact on 30-day mortality (percentage points)",
              },
              range: [-limit, limit],
              zeroline: true,
              zerolinewidth: 2,
              zerolinecolor: COLORS.ink,
            },
            yaxis: { tickfont: { size: 12, color: COLORS.ink }, showgrid: false },
            // Tinted halves: left lowers risk, right raises it.
            shapes: [
              { type: "rect", xref: "x", yref: "paper", x0: -limit, x1: 0, y0: 0, y1: 1, fillcolor: alpha(COLORS.decreases, 0.04), line: { width: 0 }, layer: "below" },
              { type: "rect", xref: "x", yref: "paper", x0: 0, x1: limit, y0: 0, y1: 1, fillcolor: alpha(COLORS.increases, 0.04), line: { width: 0 }, layer: "below" },
            ],
          })}
          config={config("risk-drivers")}
          style={{ width: "100%" }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-600 mt-2">
        {[
          { color: COLORS.increases, label: "raises risk" },
          { color: COLORS.modifiable, label: "raises risk, modifiable" },
          { color: COLORS.decreases, label: "lowers risk" },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 mt-1 leading-snug">
        Impacts are SHAP values scaled by the logistic slope at the model&apos;s working point. The
        ranking is reliable; the sizes are approximate and do not add up to the prediction, so they
        are shown side by side rather than stacked.
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-700">
          Raw SHAP values
        </summary>
        <ul className="mt-1 space-y-0.5 text-[11px] text-gray-600 font-mono">
          {result.shap_top5.map((s, i) => (
            <li key={i}>
              {s.feature} = {String(s.value)} → {fmtShap(s.shap_value)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
