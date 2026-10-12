import { COLORS, Plot, alpha, config, layout } from "@/lib/plot";
import { usePrediction } from "@/store/prediction";

// Time points (days post-procedure)
const T = [0, 30, 90, 180, 365];

// Survival probabilities by risk stratum, from published TAVR trial data
const STRATA = {
  low: {
    name: "Low risk · PARTNER 3 (Mack 2019 NEJM)",
    short: "Low",
    surv: [1.0, 0.996, 0.994, 0.992, 0.99],
    color: COLORS.low,
  },
  intermediate: {
    name: "Intermediate · SURTAVI (Reardon 2017 NEJM)",
    short: "Intermediate",
    surv: [1.0, 0.978, 0.96, 0.945, 0.933],
    color: COLORS.intermediate,
  },
  high: {
    name: "High risk · PARTNER 1A (Smith 2011 NEJM)",
    short: "High",
    surv: [1.0, 0.966, 0.92, 0.846, 0.758],
    color: COLORS.high,
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
    <div className="ibm-card p-4">
      <p className="eyebrow">Outcome context</p>
      <h3 className="card-title mb-1">Survival curve · 1 year by risk stratum</h3>
      <p className="text-xs text-gray-500 mb-2">
        Kaplan-Meier curves from published TAVR trials. This patient&apos;s predicted 30-day
        survival is plotted on the {STRATUM_LABEL[stratum]}-risk curve based on decile{" "}
        {result.lgbm_decile}/9.
      </p>
      <div className="figure-plate px-1 pt-2">
        <Plot
          data={[
            ...Object.entries(STRATA).map(([key, s]) => ({
              type: "scatter" as const,
              mode: "lines+markers" as const,
              x: T,
              y: s.surv,
              name: s.name,
              line: {
                color: s.color,
                width: key === stratum ? 3.5 : 2,
                shape: "hv" as const,
              },
              opacity: key === stratum ? 1 : 0.55,
              marker: { size: 6, color: s.color, line: { color: "#ffffff", width: 1.5 } },
              hovertemplate: `<b>${s.short} risk</b><br>Day %{x}<br>Survival %{y:.1%}<extra></extra>`,
            })),
            {
              type: "scatter" as const,
              mode: "markers" as const,
              x: [30],
              y: [patientSurv30d],
              name: "This patient (30 d, predicted)",
              marker: {
                color: COLORS.ibm,
                size: 16,
                symbol: "diamond",
                line: { color: "white", width: 2.5 },
              },
              hovertemplate: "<b>This patient</b><br>Day 30<br>Predicted survival %{y:.1%}<extra></extra>",
            },
          ]}
          layout={layout({
            height: 320,
            margin: { l: 56, r: 92, t: 10, b: 48 },
            xaxis: {
              title: { text: "Days post-procedure" },
              tickvals: T,
              ticktext: ["0", "30 d", "90 d", "6 mo", "1 yr"],
              showgrid: false,
            },
            yaxis: {
              title: { text: "Survival probability" },
              range: [0.7, 1.01],
              tickformat: ".0%",
            },
            // End-of-curve labels, so the strata read without the legend.
            annotations: [
              ...Object.values(STRATA).map((s) => ({
                x: 365,
                y: s.surv[s.surv.length - 1],
                xanchor: "left" as const,
                xshift: 8,
                text: `${s.short} ${(s.surv[s.surv.length - 1] * 100).toFixed(1)}%`,
                showarrow: false,
                font: { color: s.color, size: 11 },
              })),
              {
                x: 30,
                y: patientSurv30d,
                ax: 36,
                ay: 26,
                text: "This patient",
                arrowcolor: COLORS.ibm,
                arrowwidth: 1.2,
                font: { color: COLORS.ibmDark, size: 11 },
                bgcolor: alpha("#ffffff", 0.9),
              },
            ],
          })}
          config={config("survival-by-stratum")}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
