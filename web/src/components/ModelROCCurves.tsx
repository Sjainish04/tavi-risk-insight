import Plot from "react-plotly.js";

// Parametric ROC curve from a target AUC.
// Integral of FPR^p from 0 to 1 = 1/(p+1). Setting AUC = A → p = (1-A)/A.
// → TPR(FPR) = FPR^((1-A)/A) gives a smooth concave curve with the right area.
function generateROC(auc: number, n = 60): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const p = (1 - auc) / auc;
  for (let i = 0; i <= n; i++) {
    const fpr = i / n;
    const tpr = fpr === 0 ? 0 : Math.pow(fpr, p);
    x.push(fpr);
    y.push(tpr);
  }
  return { x, y };
}

const MODELS = [
  { name: "STS-PROM (raw)", auc: 0.64, ciLo: 0.60, ciHi: 0.68, color: "#a8a8a8" },
  { name: "STS-PROM (era-adjusted)", auc: 0.68, ciLo: 0.64, ciHi: 0.72, color: "#ffb000" },
  { name: "LightGBM v1 (synthetic)", auc: 0.743, ciLo: 0.665, ciHi: 0.813, color: "#0f62fe" },
];

export function ModelROCCurves() {
  return (
    <div className="ibm-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        ROC curves · model comparison
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        Discrimination of each scoring approach for 30-day mortality. Higher and more
        bowed curves separate survivors from non-survivors better.
      </p>
      <Plot
        data={[
          ...MODELS.map((m) => {
            const { x, y } = generateROC(m.auc);
            return {
              type: "scatter" as const,
              mode: "lines" as const,
              x,
              y,
              name: `${m.name} · AUC ${m.auc.toFixed(3)}`,
              line: { color: m.color, width: 2.5 },
              hovertemplate: `${m.name}<br>FPR %{x:.2f}<br>TPR %{y:.2f}<extra></extra>`,
            };
          }),
          {
            type: "scatter" as const,
            mode: "lines" as const,
            x: [0, 1],
            y: [0, 1],
            name: "Random (AUC 0.50)",
            line: { color: "#cccccc", dash: "dash", width: 1 },
            hoverinfo: "skip",
          },
        ]}
        layout={{
          height: 320,
          margin: { l: 60, r: 10, t: 10, b: 50 },
          xaxis: {
            title: { text: "False positive rate" },
            range: [0, 1],
            zeroline: true,
          },
          yaxis: {
            title: { text: "True positive rate" },
            range: [0, 1],
            zeroline: true,
          },
          legend: { orientation: "h", x: 0, y: -0.2, font: { size: 10 } },
          font: { family: "IBM Plex Sans, sans-serif", size: 11 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
      <table className="w-full text-[11px] mt-2">
        <thead>
          <tr className="text-gray-500 border-b border-gray-200">
            <th className="text-left py-1">Model</th>
            <th className="text-right py-1">AUC</th>
            <th className="text-right py-1">95 % CI</th>
          </tr>
        </thead>
        <tbody>
          {MODELS.map((m) => (
            <tr key={m.name} className="border-b border-gray-100 last:border-0">
              <td className="py-1">{m.name}</td>
              <td className="py-1 text-right font-mono">{m.auc.toFixed(3)}</td>
              <td className="py-1 text-right font-mono text-gray-600">
                [{m.ciLo.toFixed(3)}, {m.ciHi.toFixed(3)}]
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-400 mt-2 italic">
        Curves are parametric reconstructions from published AUC values. Bootstrap CI
        bands are in Model Card → Validation → model variants.
      </p>
    </div>
  );
}
