import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

interface DcaPoint {
  threshold: number;
  label: string; // "model" | "all" | "none"
  net_benefit: number | null;
}

interface SexStats {
  n: number;
  outcome_rate: number;
  selection_rate: number;
  auroc: number | null;
  fnr: number;
  fpr: number;
}

interface FairnessVariant {
  threshold_used: number;
  by_sex: Record<string, SexStats>;
  by_age: Record<string, { n: number; outcome_rate: number; selection_rate: number; auroc: number | null }>;
  equalized_odds_difference_sex: number;
}

interface DcaFairnessReport {
  n_test: number;
  outcome_30d_rate: number;
  thresholds: number[];
  decision_curve_analysis: Record<string, DcaPoint[]>;
  fairness: Record<string, FairnessVariant>;
}

const VARIANT_LABEL: Record<string, string> = {
  v1_lgbm_baseline: "v1 LightGBM",
  v2_lgbm_brdav: "v2 LGBM + brdav",
  v3_stacking: "v3 Stacking",
};

const VARIANT_COLOR: Record<string, string> = {
  v1_lgbm_baseline: "#8d8d8d",
  v2_lgbm_brdav: "#0072c3",
  v3_stacking: "#0f62fe",
};

export function DCAandFairness() {
  const [data, setData] = useState<DcaFairnessReport | null>(null);
  useEffect(() => {
    fetch("/dca_fairness.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
  }, []);
  if (!data) return null;

  // Build DCA traces — one "model" line per variant + one shared "all"/"none"
  const dcaTraces: Plotly.Data[] = [];
  const variantNames = Object.keys(data.decision_curve_analysis);
  // Treat-all reference (any variant has the same series)
  const refVariant = variantNames[0];
  const refPoints = data.decision_curve_analysis[refVariant] || [];
  const treatAll = refPoints.filter((p) => p.label === "all");
  const treatNone = refPoints.filter((p) => p.label === "none");
  dcaTraces.push({
    type: "scatter",
    mode: "lines",
    x: treatAll.map((p) => p.threshold),
    y: treatAll.map((p) => p.net_benefit ?? 0),
    name: "treat all",
    line: { color: "#525252", dash: "dot" as const, width: 1 },
  });
  dcaTraces.push({
    type: "scatter",
    mode: "lines",
    x: treatNone.map((p) => p.threshold),
    y: treatNone.map((p) => p.net_benefit ?? 0),
    name: "treat none",
    line: { color: "#a8a8a8", dash: "dot" as const, width: 1 },
  });
  for (const name of variantNames) {
    const modelPoints = data.decision_curve_analysis[name].filter((p) => p.label === "model");
    dcaTraces.push({
      type: "scatter",
      mode: "lines",
      x: modelPoints.map((p) => p.threshold),
      y: modelPoints.map((p) => p.net_benefit ?? 0),
      name: VARIANT_LABEL[name] ?? name,
      line: { color: VARIANT_COLOR[name] ?? "#393939", width: 2 },
    });
  }

  return (
    <section>
      <h4 className="font-semibold text-gray-900 mb-1">
        Decision-Curve Analysis · {data.n_test}-patient held-out test
      </h4>
      <p className="text-xs text-gray-700 leading-relaxed mb-2">
        Population-level Net Benefit (Vickers &amp; Elkin 2006) at clinical thresholds.
        Computed via MSKCC's <code>dcurves</code>. Higher = better; a model line
        below "treat all" or "treat none" at a threshold means using the model harms
        decisions at that threshold.
      </p>
      <Plot
        data={dcaTraces}
        layout={{
          autosize: true,
          height: 280,
          margin: { l: 56, r: 12, t: 8, b: 40 },
          xaxis: {
            title: { text: "Decision threshold (probability)" },
            tickformat: ".0%",
            range: [0, 0.21],
          },
          yaxis: {
            title: { text: "Net benefit" },
            tickformat: ".3f",
          },
          legend: { x: 0.7, y: 0.98, font: { size: 10 } },
          font: { size: 11 },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
        At low thresholds (~1-3%, common for screening) all variants beat treat-all
        and treat-none. As threshold rises (toward "only treat very high-risk")
        the v3 stacking ensemble retains the most net benefit.
      </p>

      <h4 className="font-semibold text-gray-900 mt-4 mb-1">
        Fairness audit · top-decile flagging by sex (Microsoft <code>fairlearn</code>)
      </h4>
      <p className="text-xs text-gray-700 leading-relaxed mb-2">
        Equalized-Odds Difference (EOD) measures disparity in true-positive and
        false-positive rates across groups; closer to 0 is fairer. AUROC by sex
        shows discrimination ability per group — small gaps preferred.
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-gray-300 text-gray-600">
              <th className="text-left py-1 pr-2">Variant</th>
              <th className="text-right py-1 px-2">EOD (sex)</th>
              <th className="text-right py-1 px-2">Female AUROC</th>
              <th className="text-right py-1 px-2">Male AUROC</th>
              <th className="text-right py-1 px-2">Female FNR</th>
              <th className="text-right py-1 pl-2">Male FNR</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.fairness).map(([name, f]) => {
              const female = f.by_sex.female;
              const male = f.by_sex.male;
              return (
                <tr key={name} className="border-b border-gray-100">
                  <td className="py-1 pr-2 font-medium">{VARIANT_LABEL[name] ?? name}</td>
                  <td className="py-1 px-2 text-right font-mono">
                    {f.equalized_odds_difference_sex.toFixed(3)}
                  </td>
                  <td className="py-1 px-2 text-right font-mono">
                    {female?.auroc != null ? female.auroc.toFixed(3) : "—"}
                  </td>
                  <td className="py-1 px-2 text-right font-mono">
                    {male?.auroc != null ? male.auroc.toFixed(3) : "—"}
                  </td>
                  <td className="py-1 px-2 text-right font-mono">
                    {female ? female.fnr.toFixed(3) : "—"}
                  </td>
                  <td className="py-1 pl-2 text-right font-mono">
                    {male ? male.fnr.toFixed(3) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
        <strong>Notable:</strong> v2 LightGBM-with-brdav has the most uniform AUROC
        across sex (0.756 F vs 0.752 M, gap 0.004) — adding the real-cohort
        oracle as a feature <em>improved fairness</em>. v3 stacking has the highest
        absolute AUROC in both groups but a wider EOD (0.125), trading some
        uniformity for accuracy. v1 baseline shows an 8-pp female-male AUROC gap
        — the largest fairness concern of the three.
      </p>
    </section>
  );
}
