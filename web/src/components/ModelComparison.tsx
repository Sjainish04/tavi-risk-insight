import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

interface CalibrationPoint {
  decile: number;
  n: number;
  pred_mean: number;
  actual_mortality: number;
}

interface VariantOk {
  name: string;
  label: string;
  n_features: number;
  uses_brdav: boolean;
  train_seconds: number;
  auroc: number;
  auroc_ci_lo: number;
  auroc_ci_hi: number;
  auprc: number;
  auprc_ci_lo: number;
  auprc_ci_hi: number;
  brier: number;
  o_over_e: number;
  calibration_intercept: number;
  calibration_slope: number;
  calibration_curve: CalibrationPoint[];
  calibration_raw_o_over_e: number;
  skipped?: false;
}

interface BrdavOnTest {
  name: string;
  label: string;
  calibration_curve: CalibrationPoint[];
  auroc: number;
  auroc_ci_lo: number;
  auroc_ci_hi: number;
}

interface VariantSkipped {
  name: string;
  label: string;
  n_features: number;
  uses_brdav: boolean;
  skipped: true;
  skip_reason: string;
}

type Variant = VariantOk | VariantSkipped;

interface Benchmark {
  name: string;
  cohort: string;
  auroc: string;
  endpoint: string;
  url: string;
}

interface ComparisonReport {
  n_train: number;
  n_test: number;
  base_rate: number;
  cohort: string;
  n_bootstraps: number;
  variants: Variant[];
  brdav_on_test?: BrdavOnTest;
  external_benchmarks: Benchmark[];
}

const VARIANT_COLOR: Record<string, string> = {
  v1_lgbm_baseline: "#8d8d8d",
  v2_lgbm_brdav: "#0072c3",
  v3_stacking: "#0f62fe",
  v4_tabpfn: "#8a3ffc",
  brdav_followup: "#da1e28",
};

export function ModelComparison() {
  const [data, setData] = useState<ComparisonReport | null>(null);
  useEffect(() => {
    fetch("/model_comparison.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
  }, []);
  if (!data) return null;

  const fmt = (v: number, d: number = 3) => v.toFixed(d);

  // Find max AUROC among non-skipped variants for the highlight
  const maxAuroc = Math.max(
    ...data.variants
      .filter((v): v is VariantOk => !v.skipped)
      .map((v) => v.auroc),
  );

  return (
    <section>
      <h4 className="font-semibold text-gray-900 mb-1">
        Model variants — bootstrap 95% CI on a {data.n_test.toLocaleString()}-patient
        held-out test set
      </h4>
      <p className="text-xs text-gray-700 leading-relaxed mb-2">
        Four variants trained on the same {data.n_train.toLocaleString()}-patient
        synthetic train fold (same stratified split, seed 42). Confidence intervals
        from {data.n_bootstraps} non-parametric bootstraps of the test set.
        v2/v3/v4 use Brüggemann 2024's predictions on each patient as a 27th
        feature — real-data knowledge transfer.
      </p>

      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-gray-300 text-gray-600">
              <th className="text-left py-1 pr-2">Variant</th>
              <th className="text-right py-1 px-2">n_feat</th>
              <th className="text-right py-1 px-2">brdav?</th>
              <th className="text-right py-1 px-2">AUROC [95% CI]</th>
              <th className="text-right py-1 px-2">AUPRC</th>
              <th className="text-right py-1 px-2">Brier</th>
              <th className="text-right py-1 px-2">O/E</th>
              <th className="text-right py-1 pl-2">Train (s)</th>
            </tr>
          </thead>
          <tbody>
            {data.variants.map((v) => {
              if (v.skipped) {
                return (
                  <tr key={v.name} className="border-b border-gray-100 text-gray-400">
                    <td className="py-1 pr-2">{v.label}</td>
                    <td colSpan={7} className="py-1 px-2 text-right italic">
                      skipped — {v.skip_reason.slice(0, 80)}…
                    </td>
                  </tr>
                );
              }
              const isWinner = v.auroc === maxAuroc;
              return (
                <tr
                  key={v.name}
                  className={`border-b border-gray-100 ${isWinner ? "bg-blue-50 font-medium" : ""}`}
                >
                  <td className="py-1 pr-2">{v.label}{isWinner && <span className="text-ibm-500 ml-1">★</span>}</td>
                  <td className="py-1 px-2 text-right font-mono">{v.n_features}</td>
                  <td className="py-1 px-2 text-right">{v.uses_brdav ? "yes" : "no"}</td>
                  <td className="py-1 px-2 text-right font-mono">
                    {fmt(v.auroc)} [{fmt(v.auroc_ci_lo)}, {fmt(v.auroc_ci_hi)}]
                  </td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(v.auprc)}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(v.brier, 4)}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(v.o_over_e, 2)}</td>
                  <td className="py-1 pl-2 text-right font-mono">{fmt(v.train_seconds, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
        ★ winner by AUROC. <strong>v4 TabPFN</strong> beats all locals but runs in
        Prior Labs cloud (data leaves the box). <strong>v3 stacking</strong> is the
        production deployment — best LOCAL model, fully offline. v2 (LGBM gaining
        brdav as feature 27) is a single-model alternative.
      </p>

      <h4 className="font-semibold text-gray-900 mt-4 mb-1">
        Reliability diagram — raw model probability vs actual 30-d mortality on the
        same {data.n_test}-patient held-out test
      </h4>
      <p className="text-xs text-gray-700 leading-relaxed mb-2">
        Each model's predictions are split into 10 quantile bins; for each bin we
        plot mean predicted probability (x) vs actual outcome rate (y). Closer to
        the 45° diagonal = better-calibrated <em>before isotonic</em>. brdav lives
        on the right because it predicts a different (longer-horizon) endpoint —
        it's plotted to make the endpoint mismatch visible, not for fair calibration
        comparison.
      </p>
      <Plot
        data={[
          // Diagonal reference
          {
            type: "scatter",
            mode: "lines",
            x: [0, 0.7],
            y: [0, 0.7],
            line: { color: "#cccccc", dash: "dot" as const, width: 1 },
            name: "perfect calibration",
            hoverinfo: "skip",
            showlegend: true,
          },
          // Each variant
          ...data.variants
            .filter((v): v is VariantOk => !v.skipped)
            .map((v) => ({
              type: "scatter" as const,
              mode: "lines+markers" as const,
              x: v.calibration_curve.map((p) => p.pred_mean),
              y: v.calibration_curve.map((p) => p.actual_mortality),
              name: `${v.label.split(" (")[0]} (raw O/E ${v.calibration_raw_o_over_e.toFixed(2)})`,
              marker: { color: VARIANT_COLOR[v.name] ?? "#393939", size: 7 },
              line: { color: VARIANT_COLOR[v.name] ?? "#393939", width: 2 },
            })),
          // Brdav as a separate trace
          ...(data.brdav_on_test
            ? [
                {
                  type: "scatter" as const,
                  mode: "lines+markers" as const,
                  x: data.brdav_on_test.calibration_curve.map((p) => p.pred_mean),
                  y: data.brdav_on_test.calibration_curve.map((p) => p.actual_mortality),
                  name: "Brüggemann 2024 oracle (different endpoint)",
                  marker: { color: VARIANT_COLOR.brdav_followup, size: 7, symbol: "diamond" },
                  line: { color: VARIANT_COLOR.brdav_followup, width: 2, dash: "dash" as const },
                },
              ]
            : []),
        ]}
        layout={{
          autosize: true,
          height: 340,
          margin: { l: 56, r: 12, t: 8, b: 44 },
          xaxis: {
            title: { text: "Mean predicted probability (raw, pre-isotonic)" },
            tickformat: ".0%",
            range: [0, 0.7],
          },
          yaxis: {
            title: { text: "Actual 30-d mortality" },
            tickformat: ".0%",
            range: [0, 0.25],
          },
          legend: { x: 0.02, y: 0.98, font: { size: 10 }, bgcolor: "rgba(255,255,255,0.85)" },
          font: { size: 11 },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
        <strong>Reading this plot:</strong> v1 LightGBM raw probabilities are
        compressed (O/E 2.93 — under-predicts by 3×) which is why isotonic
        calibration helps it most. <strong>v3 stacking is naturally well-calibrated
        even raw (O/E 1.06)</strong> — that's the ensemble averaging out individual
        member biases. v4 TabPFN sits between (O/E 1.43). brdav's curve sits on the
        right (predicted 21–66%) but actual 30-d mortality maxes at 14% in its top
        decile — visible proof the endpoint differs.
      </p>

      <h4 className="font-semibold text-gray-900 mt-4 mb-1">
        External benchmarks — published AUROC on real cohorts
      </h4>
      <p className="text-xs text-gray-700 leading-relaxed mb-2">
        Where our number sits in the published real-world band. Direct comparison
        is imperfect (different cohorts, endpoints, eras) — but it answers the
        natural Q&amp;A question "is 0.78 any good?".
      </p>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="border-b border-gray-300 text-gray-600">
              <th className="text-left py-1 pr-2">Model</th>
              <th className="text-left py-1 px-2">Cohort</th>
              <th className="text-left py-1 px-2">Endpoint</th>
              <th className="text-right py-1 pl-2">AUROC</th>
            </tr>
          </thead>
          <tbody>
            {data.external_benchmarks.map((b) => (
              <tr key={b.name} className="border-b border-gray-100">
                <td className="py-1 pr-2">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ibm-500 hover:underline"
                  >
                    {b.name}
                  </a>
                </td>
                <td className="py-1 px-2 text-gray-700">{b.cohort}</td>
                <td className="py-1 px-2 text-gray-700">{b.endpoint}</td>
                <td className="py-1 pl-2 text-right font-mono">{b.auroc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
        Our v3 stacking AUROC <strong>0.781</strong> sits inside the published
        real-data benchmark band (Brüggemann 0.725 real • Cui 2025 MULTINet ~0.78 real
        MIMIC-IV • TRIM 0.75 real GARY). STS-PROM 0.62-0.66 and EuroSCORE II 0.62 are
        the legacy floor.
      </p>
    </section>
  );
}
