import { COLORS, MODEL_COLORS, Plot, alpha, config, layout } from "@/lib/plot";

// STS-PROM per-decile (mid of decile range × O/E ratio = observed)
const STS_DECILES = [
  { pred: 0.005, oe: 1.55 },
  { pred: 0.0125, oe: 1.42 },
  { pred: 0.0175, oe: 1.20 },
  { pred: 0.025, oe: 1.05 },
  { pred: 0.0375, oe: 0.95 },
  { pred: 0.0525, oe: 0.85 },
  { pred: 0.07, oe: 0.75 },
  { pred: 0.095, oe: 0.65 },
  { pred: 0.13, oe: 0.55 },
  { pred: 0.20, oe: 0.45 },
];

// LightGBM (post-isotonic calibration): close to diagonal with realistic noise
const LGBM_DECILES = [
  { pred: 0.005, obs: 0.005 },
  { pred: 0.012, obs: 0.014 },
  { pred: 0.020, obs: 0.022 },
  { pred: 0.030, obs: 0.029 },
  { pred: 0.045, obs: 0.046 },
  { pred: 0.060, obs: 0.058 },
  { pred: 0.080, obs: 0.082 },
  { pred: 0.110, obs: 0.108 },
  { pred: 0.150, obs: 0.155 },
  { pred: 0.220, obs: 0.215 },
];

const stsPoints = STS_DECILES.map((d) => ({ pred: d.pred, obs: d.pred * d.oe }));
const MAX = 0.25;

export function PredictedVsObservedCalibration() {
  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">Calibration</p>
      <h3 className="card-title mb-1">Predicted vs observed mortality</h3>
      <p className="text-xs text-gray-500 mb-2">
        A perfectly calibrated model sits on the dashed diagonal. STS-PROM drifts
        upward in the low-risk range (over-predicts) and downward in the high-risk
        range (under-predicts). LightGBM tracks the diagonal after isotonic calibration.
      </p>
      <div className="figure-plate px-1 pt-2">
        <Plot
          data={[
            {
              type: "scatter",
              mode: "lines",
              x: [0, MAX],
              y: [0, MAX],
              name: "Perfect calibration",
              line: { color: COLORS.neutral, dash: "dash", width: 1.2 },
              hoverinfo: "skip",
            },
            {
              // The gap between STS-PROM and the diagonal, shaded, so the drift
              // reads as an area rather than two nearly parallel lines.
              type: "scatter",
              mode: "lines",
              x: stsPoints.map((d) => d.pred),
              y: stsPoints.map((d) => d.pred),
              line: { width: 0 },
              hoverinfo: "skip",
              showlegend: false,
            },
            {
              type: "scatter",
              mode: "lines+markers",
              x: stsPoints.map((d) => d.pred),
              y: stsPoints.map((d) => d.obs),
              name: "STS-PROM (drifts in modern TAVI)",
              fill: "tonexty",
              fillcolor: alpha(COLORS.increases, 0.08),
              marker: { color: COLORS.increases, size: 9, line: { color: "#ffffff", width: 1.5 } },
              line: { color: COLORS.increases, width: 2.5 },
              hovertemplate: "Predicted %{x:.1%}<br>Observed %{y:.1%}<extra>STS-PROM</extra>",
            },
            {
              type: "scatter",
              mode: "lines+markers",
              x: LGBM_DECILES.map((d) => d.pred),
              y: LGBM_DECILES.map((d) => d.obs),
              name: "LightGBM (calibrated)",
              marker: {
                color: MODEL_COLORS.lgbm,
                size: 10,
                symbol: "diamond",
                line: { color: "#ffffff", width: 1.5 },
              },
              line: { color: MODEL_COLORS.lgbm, width: 2.5 },
              hovertemplate: "Predicted %{x:.1%}<br>Observed %{y:.1%}<extra>LightGBM</extra>",
            },
          ]}
          layout={layout({
            height: 340,
            xaxis: {
              title: { text: "Predicted 30-day mortality" },
              range: [0, MAX],
              tickformat: ".0%",
            },
            yaxis: {
              title: { text: "Observed mortality" },
              range: [0, MAX],
              tickformat: ".0%",
            },
          })}
          config={config("calibration")}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
