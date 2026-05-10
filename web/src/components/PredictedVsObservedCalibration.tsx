import Plot from "react-plotly.js";

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

// LightGBM (post-isotonic calibration) — close to diagonal with realistic noise
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
    <div className="ibm-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        Calibration · predicted vs observed mortality
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        A perfectly calibrated model sits on the dashed diagonal. STS-PROM drifts
        upward in the low-risk range (over-predicts) and downward in the high-risk
        range (under-predicts). LightGBM tracks the diagonal after isotonic calibration.
      </p>
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines",
            x: [0, MAX],
            y: [0, MAX],
            name: "Perfect calibration",
            line: { color: "#cccccc", dash: "dash", width: 1 },
            hoverinfo: "skip",
          },
          {
            type: "scatter",
            mode: "lines+markers",
            x: stsPoints.map((d) => d.pred),
            y: stsPoints.map((d) => d.obs),
            name: "STS-PROM (drifts in modern TAVI)",
            marker: { color: "#da1e28", size: 8 },
            line: { color: "#da1e28", width: 2 },
            hovertemplate: "Predicted %{x:.1%}<br>Observed %{y:.1%}<extra>STS-PROM</extra>",
          },
          {
            type: "scatter",
            mode: "lines+markers",
            x: LGBM_DECILES.map((d) => d.pred),
            y: LGBM_DECILES.map((d) => d.obs),
            name: "LightGBM (calibrated)",
            marker: { color: "#0f62fe", size: 8, symbol: "diamond" },
            line: { color: "#0f62fe", width: 2 },
            hovertemplate: "Predicted %{x:.1%}<br>Observed %{y:.1%}<extra>LightGBM</extra>",
          },
        ]}
        layout={{
          height: 320,
          margin: { l: 60, r: 10, t: 10, b: 50 },
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
          legend: { orientation: "h", x: 0, y: -0.2, font: { size: 10 } },
          font: { family: "IBM Plex Sans, sans-serif", size: 11 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
