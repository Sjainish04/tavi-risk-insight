import { COLORS, Plot, alpha, config, layout } from "@/lib/plot";

import { usePrediction } from "@/store/prediction";

// Same recalibration table the backend uses (api/scoring/recalibration.py).
// Hard-coded here so the plot renders without an additional round-trip.
const O_E_TABLE = [
  { decile: 0, range: "<1%", oe: 1.55 },
  { decile: 1, range: "1.0–1.5%", oe: 1.42 },
  { decile: 2, range: "1.5–2.0%", oe: 1.20 },
  { decile: 3, range: "2.0–3.0%", oe: 1.05 },
  { decile: 4, range: "3.0–4.5%", oe: 0.95 },
  { decile: 5, range: "4.5–6.0%", oe: 0.85 },
  { decile: 6, range: "6.0–8.0%", oe: 0.75 },
  { decile: 7, range: "8.0–11%", oe: 0.65 },
  { decile: 8, range: "11–15%", oe: 0.55 },
  { decile: 9, range: ">15%", oe: 0.45 },
];

export function CalibrationPlot() {
  const result = usePrediction((s) => s.result);
  const patientDecile = result?.sts_prom.decile ?? null;

  const colors = O_E_TABLE.map((d) =>
    d.decile === patientDecile ? COLORS.ibm : d.oe > 1 ? alpha(COLORS.modifiable, 0.75) : alpha(COLORS.ibmDark, 0.55),
  );

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">Calibration drift</p>
      <h3 className="card-title mb-2">Era-aware drift: STS-PROM in modern TAVI</h3>
      <div className="figure-plate px-1 pt-2">
      <Plot
        data={[
          {
            type: "bar",
            x: O_E_TABLE.map((d) => `D${d.decile}`),
            y: O_E_TABLE.map((d) => d.oe),
            marker: { color: colors, line: { color: "#ffffff", width: 1 } },
            text: O_E_TABLE.map((d) => d.oe.toFixed(2)),
            textposition: "outside",
            textfont: { family: "ui-monospace, Menlo, monospace", size: 10 },
            cliponaxis: false,
            customdata: O_E_TABLE.map((d) => [d.range]),
            hovertemplate:
              "Decile %{x}<br>Raw STS range: %{customdata[0]}<br>O/E: %{y}<extra></extra>",
          },
          {
            type: "scatter",
            mode: "lines",
            x: O_E_TABLE.map((d) => `D${d.decile}`),
            y: Array(O_E_TABLE.length).fill(1.0),
            line: { color: COLORS.ink, dash: "dash", width: 1.2 },
            hoverinfo: "skip",
            showlegend: false,
          },
        ]}
        layout={layout({
          height: 280,
          bargap: 0.3,
          xaxis: { title: { text: "Raw STS-PROM decile" }, showgrid: false },
          yaxis: { title: { text: "Observed / Expected" }, range: [0, 1.8] },
          showlegend: false,
        })}
        config={config("sts-calibration-drift")}
        style={{ width: "100%" }}
      />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Patient's decile highlighted in IBM blue. O/E &gt; 1 means STS-PROM
        under-predicts; &lt; 1 means it over-predicts.
      </p>
    </div>
  );
}
