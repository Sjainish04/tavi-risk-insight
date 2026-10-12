import { COLORS, Plot, alpha, config, layout } from "@/lib/plot";

import { usePrediction } from "@/store/prediction";

export function DecisionCurvePlot() {
  const result = usePrediction((s) => s.result);

  if (!result) {
    return (
      <div className="ibm-card p-3 h-[290px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Decision curve analysis
        </h3>
        <p className="text-xs text-gray-500">Submit the form first.</p>
      </div>
    );
  }

  const dca = result.decision_curve;
  const xs = dca.map((d) => d.threshold * 100);

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">Clinical utility</p>
      <h3 className="card-title mb-2">Decision curve analysis</h3>
      <div className="figure-plate px-1 pt-2">
      <Plot
        data={[
          {
            x: xs,
            y: dca.map((d) => d.net_benefit_model),
            mode: "lines+markers",
            name: "LightGBM",
            line: { color: COLORS.ibm, width: 3 },
            marker: { size: 7, color: COLORS.ibm, line: { color: "#ffffff", width: 1.5 } },
            fill: "tozeroy",
            fillcolor: alpha(COLORS.ibm, 0.06),
          },
          {
            x: xs,
            y: dca.map((d) => d.net_benefit_treat_all),
            mode: "lines",
            name: "Treat all",
            line: { color: COLORS.modifiable, width: 1.5, dash: "dot" },
          },
          {
            x: xs,
            y: dca.map((d) => d.net_benefit_treat_none),
            mode: "lines",
            name: "Treat none",
            line: { color: COLORS.muted, width: 1.5, dash: "dot" },
          },
        ]}
        layout={layout({
          height: 290,
          xaxis: { title: { text: "Threshold probability (%)" } },
          yaxis: { title: { text: "Net benefit" } },
        })}
        config={config("decision-curve")}
        style={{ width: "100%" }}
      />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Vickers &amp; Elkin 2006: the model is clinically useful where its line
        sits above both treat-all and treat-none baselines.
      </p>
    </div>
  );
}
