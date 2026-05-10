import Plot from "react-plotly.js";

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
    <div className="ibm-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">
        Decision curve analysis
      </h3>
      <Plot
        data={[
          {
            x: xs,
            y: dca.map((d) => d.net_benefit_model),
            mode: "lines+markers",
            name: "LightGBM",
            line: { color: "#0f62fe", width: 2 },
            marker: { size: 6 },
          },
          {
            x: xs,
            y: dca.map((d) => d.net_benefit_treat_all),
            mode: "lines",
            name: "Treat all",
            line: { color: "#ffb000", width: 1, dash: "dot" },
          },
          {
            x: xs,
            y: dca.map((d) => d.net_benefit_treat_none),
            mode: "lines",
            name: "Treat none",
            line: { color: "#525252", width: 1, dash: "dot" },
          },
        ]}
        layout={{
          height: 260,
          margin: { l: 50, r: 10, t: 10, b: 40 },
          xaxis: { title: { text: "Threshold probability (%)" } },
          yaxis: { title: { text: "Net benefit" } },
          legend: { orientation: "h", x: 0, y: -0.25, font: { size: 10 } },
          font: { family: "Times New Roman, Times, serif", size: 11 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
      <p className="text-xs text-gray-500 mt-1">
        Vickers &amp; Elkin 2006 — model is clinically useful where its line
        sits above both treat-all and treat-none baselines.
      </p>
    </div>
  );
}
