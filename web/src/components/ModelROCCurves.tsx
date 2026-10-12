import { COLORS, MODEL_COLORS, Plot, alpha, config, layout } from "@/lib/plot";

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
  { name: "STS-PROM (raw)", auc: 0.64, ciLo: 0.60, ciHi: 0.68, color: MODEL_COLORS.stsRaw },
  { name: "STS-PROM (era-adjusted)", auc: 0.68, ciLo: 0.64, ciHi: 0.72, color: MODEL_COLORS.stsRecal },
  { name: "LightGBM v1 (synthetic)", auc: 0.743, ciLo: 0.665, ciHi: 0.813, color: MODEL_COLORS.lgbm },
];

export function ModelROCCurves() {
  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">Discrimination</p>
      <h3 className="card-title mb-1">ROC curves · model comparison</h3>
      <p className="text-xs text-gray-500 mb-2">
        Discrimination of each scoring approach for 30-day mortality. Higher and more
        bowed curves separate survivors from non-survivors better.
      </p>
      <div className="figure-plate px-1 pt-2">
      <Plot
        data={[
          ...MODELS.map((m, i) => {
            const { x, y } = generateROC(m.auc);
            return {
              type: "scatter" as const,
              mode: "lines" as const,
              x,
              y,
              name: `${m.name} · AUC ${m.auc.toFixed(3)}`,
              line: { color: m.color, width: i === MODELS.length - 1 ? 3.5 : 2.5 },
              // The best model's area is shaded lightly: AUC is that area.
              fill: i === MODELS.length - 1 ? ("tozeroy" as const) : ("none" as const),
              fillcolor: alpha(m.color, 0.07),
              hovertemplate: `${m.name}<br>FPR %{x:.2f}<br>TPR %{y:.2f}<extra></extra>`,
            };
          }),
          {
            type: "scatter" as const,
            mode: "lines" as const,
            x: [0, 1],
            y: [0, 1],
            name: "Random (AUC 0.50)",
            line: { color: COLORS.neutral, dash: "dash", width: 1.2 },
            hoverinfo: "skip",
          },
        ]}
        layout={layout({
          height: 360,
          xaxis: { title: { text: "False positive rate" }, range: [0, 1] },
          yaxis: { title: { text: "True positive rate" }, range: [0, 1.02] },
        })}
        config={config("roc-curves")}
        style={{ width: "100%" }}
      />
      </div>
      <table className="w-full text-[11px] mt-3">
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
