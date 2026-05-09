import Plot from "react-plotly.js";

import { fmtShap } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

export function ShapWaterfall() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;

  // Use clinical-language drivers when available; sort by ascending magnitude for waterfall
  const drivers = [...result.risk_score_drivers].sort(
    (a, b) => a.magnitude_pp - b.magnitude_pp,
  );

  if (drivers.length === 0) return null;

  return (
    <div className="ibm-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">
        Top contributors to risk-score prediction
      </h3>
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            // Show signed pp magnitude so red = adds risk, green = subtracts
            x: drivers.map((d) => (d.effect === "increases" ? d.magnitude_pp : -d.magnitude_pp)),
            y: drivers.map((d) => d.feature_label),
            marker: {
              color: drivers.map((d) => {
                if (d.is_modifiable && d.effect === "increases") return "#f1c21b"; // modifiable amber
                return d.effect === "increases" ? "#da1e28" : "#198038";
              }),
            },
            text: drivers.map((d) =>
              d.effect === "increases" ? `+${d.magnitude_pp.toFixed(1)} pp` : `−${d.magnitude_pp.toFixed(1)} pp`,
            ),
            textposition: "outside",
            hovertemplate:
              "%{y}<br>impact: %{text}<extra></extra>",
          },
        ]}
        layout={{
          height: 220,
          margin: { l: 220, r: 40, t: 10, b: 30 },
          xaxis: { title: { text: "Risk impact (percentage points)" }, zeroline: true },
          yaxis: { automargin: true, tickfont: { size: 11 } },
          font: { family: "IBM Plex Sans, sans-serif", size: 11 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#da1e28]" /> increases risk
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#f1c21b]" /> modifiable (increases risk)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#198038]" /> decreases risk
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mt-1 leading-snug">
        Approximate per-feature impact in absolute percentage points (SHAP × logistic working-point slope).
        Ranking is reliable; absolute pp is a heuristic.
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
