import { COLORS, Plot, alpha, config, layout } from "@/lib/plot";

import { usePrediction } from "@/store/prediction";

export function SensitivityAnalysis() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;

  const modifiables = result.risk_score_drivers
    .filter((d) => d.is_modifiable && d.effect === "increases")
    .sort((a, b) => b.magnitude_pp - a.magnitude_pp);

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">What-if</p>
      <h3 className="card-title mb-1">Risk reduction from modifiable factors</h3>
      <p className="text-xs text-gray-500 mb-2">
        Estimated 30-day risk drop if each modifiable factor reaches its target before
        the procedure. Approximations from per-feature SHAP magnitudes.
      </p>
      {modifiables.length === 0 ? (
        <div className="figure-plate p-5 text-center">
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
                marker: { color: alpha(COLORS.ibm, 0.8), line: { color: COLORS.ibm, width: 1.5 } },
                text: modifiables.map((d) => `−${d.magnitude_pp.toFixed(1)} pp`),
                textposition: "outside",
                textfont: { family: "ui-monospace, Menlo, monospace", size: 11 },
                cliponaxis: false,
                hovertemplate: "%{y}<br>Estimated reduction: %{x:.1f} pp<extra></extra>",
              },
            ]}
            layout={layout({
              height: Math.max(170, 60 + modifiables.length * 56),
              margin: { l: 12, r: 64, t: 8, b: 48 },
              bargap: 0.4,
              xaxis: {
                title: { text: "Estimated risk reduction (percentage points)" },
                zeroline: true,
                zerolinecolor: COLORS.ink,
              },
              yaxis: { tickfont: { size: 12, color: COLORS.ink }, showgrid: false },
              showlegend: false,
            })}
            config={config("what-if")}
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
