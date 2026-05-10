import Plot from "react-plotly.js";

import { usePrediction } from "@/store/prediction";

export function SensitivityAnalysis() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;

  const modifiables = result.risk_score_drivers
    .filter((d) => d.is_modifiable && d.effect === "increases")
    .sort((a, b) => b.magnitude_pp - a.magnitude_pp);

  return (
    <div className="ibm-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        What-if · risk reduction from modifiable factors
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        Estimated 30-day risk drop if each modifiable factor reaches its target before
        the procedure. Approximations from per-feature SHAP magnitudes.
      </p>
      {modifiables.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-4 text-center">
          <p className="text-sm text-gray-700 font-medium">
            No modifiable factors flagged for this patient.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Top drivers are non-modifiable (age, prior comorbidities). Heart Team focus
            on procedural planning and post-op recovery.
          </p>
        </div>
      ) : (
        <>
          <Plot
            data={[
              {
                type: "bar",
                orientation: "h",
                x: modifiables.map((d) => d.magnitude_pp),
                y: modifiables.map(
                  (d) => `${d.feature_label}${d.modify_to ? ` → ${d.modify_to}` : ""}`,
                ),
                marker: { color: "#0f62fe" },
                text: modifiables.map((d) => `−${d.magnitude_pp.toFixed(1)} pp`),
                textposition: "outside",
                hovertemplate: "%{y}<br>Estimated reduction: %{x:.1f} pp<extra></extra>",
              },
            ]}
            layout={{
              height: Math.max(160, 50 + modifiables.length * 60),
              margin: { l: 280, r: 60, t: 10, b: 40 },
              xaxis: {
                title: { text: "Estimated risk reduction (percentage points)" },
                zeroline: true,
              },
              yaxis: { tickfont: { size: 11 } },
              font: { family: "IBM Plex Sans, sans-serif", size: 11 },
              paper_bgcolor: "white",
              plot_bgcolor: "white",
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
          />
          <p className="text-[10px] text-gray-400 mt-1 italic">
            Pre-op anaemia treatment, eGFR optimisation, and frailty pre-habilitation are
            common Heart Team interventions. Real reductions depend on time available
            before the procedure.
          </p>
        </>
      )}
    </div>
  );
}
