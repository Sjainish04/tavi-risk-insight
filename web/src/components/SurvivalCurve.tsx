import Plot from "react-plotly.js";

import { usePrediction } from "@/store/prediction";

// Time points (days post-procedure)
const T = [0, 30, 90, 180, 365];

// Survival probabilities by risk stratum, from published TAVR trial data
const STRATA = {
  low: {
    name: "Low risk · PARTNER 3 (Mack 2019 NEJM)",
    surv: [1.0, 0.996, 0.994, 0.992, 0.99],
    color: "#198038",
  },
  intermediate: {
    name: "Intermediate · SURTAVI (Reardon 2017 NEJM)",
    surv: [1.0, 0.978, 0.96, 0.945, 0.933],
    color: "#f1c21b",
  },
  high: {
    name: "High risk · PARTNER 1A (Smith 2011 NEJM)",
    surv: [1.0, 0.966, 0.92, 0.846, 0.758],
    color: "#da1e28",
  },
};

function deciledStratum(decile: number): keyof typeof STRATA {
  if (decile <= 3) return "low";
  if (decile <= 6) return "intermediate";
  return "high";
}

const STRATUM_LABEL: Record<keyof typeof STRATA, string> = {
  low: "low",
  intermediate: "intermediate",
  high: "high",
};

export function SurvivalCurve() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;

  const stratum = deciledStratum(result.lgbm_decile);
  const patientSurv30d = 1 - result.lgbm.raw_probability;

  return (
    <div className="ibm-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        Survival curve · 1-year by risk stratum
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        Kaplan-Meier curves from published TAVR trials. This patient's predicted 30-day
        survival is plotted on the {STRATUM_LABEL[stratum]}-risk curve based on decile{" "}
        {result.lgbm_decile}/9.
      </p>
      <Plot
        data={[
          ...Object.values(STRATA).map((s) => ({
            type: "scatter" as const,
            mode: "lines+markers" as const,
            x: T,
            y: s.surv,
            name: s.name,
            line: { color: s.color, width: 2, shape: "hv" as const },
            marker: { size: 5, color: s.color },
            hovertemplate: "Day %{x}<br>Survival %{y:.1%}<extra></extra>",
          })),
          {
            type: "scatter" as const,
            mode: "markers" as const,
            x: [30],
            y: [patientSurv30d],
            name: "This patient (30 d, predicted)",
            marker: { color: "#0f62fe", size: 14, symbol: "diamond", line: { color: "white", width: 2 } },
            hovertemplate: "This patient<br>Day 30<br>Predicted survival %{y:.1%}<extra></extra>",
          },
        ]}
        layout={{
          height: 300,
          margin: { l: 60, r: 10, t: 10, b: 50 },
          xaxis: {
            title: { text: "Days post-procedure" },
            tickvals: T,
            ticktext: ["0", "30 d", "90 d", "6 mo", "1 yr"],
          },
          yaxis: {
            title: { text: "Survival probability" },
            range: [0.7, 1.01],
            tickformat: ".0%",
          },
          legend: { orientation: "h", x: 0, y: -0.25, font: { size: 10 } },
          font: { family: "Times New Roman, Times, serif", size: 11 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
