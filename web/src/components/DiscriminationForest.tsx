import { COLORS, Plot, alpha, config, layout } from "@/lib/plot";
import {
  type ModelComparisonReport,
  VARIANT_COLORS as VARIANT_COLOR,
  VARIANT_SHORT,
  servingVariant,
  useReport,
} from "@/lib/reports";
import { usePrediction } from "@/store/prediction";

/** Reads "0.725", "~0.78", "0.62–0.66" or "0.75 (Swiss external)" as a point,
 *  or a low/high pair when the source gives a range. */
function parseAuroc(text: string): { mid: number; lo: number; hi: number } | null {
  const nums = (text.match(/\d+\.\d+/g) ?? []).map(Number);
  if (nums.length === 0) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return { mid: (lo + hi) / 2, lo, hi };
}

/** Discrimination with its uncertainty: AUROC and the bootstrap 95% CI for each
 *  variant on the held-out test set, against published AUROCs from real
 *  cohorts. A forest plot rather than ROC curves: the report stores the AUROC
 *  and its interval, not the curves, and drawing curves from a single number
 *  would invent their shape. */
export function DiscriminationForest() {
  const result = usePrediction((s) => s.result);
  const { data, error } = useReport<ModelComparisonReport>("/model_comparison.json");
  const serving = result ? servingVariant(result.primary_model_name) : null;

  const variants = (data?.variants ?? []).filter((v) => !v.skipped);
  const published = (data?.external_benchmarks ?? [])
    .map((b) => ({ ...b, value: parseAuroc(b.auroc) }))
    .filter((b): b is typeof b & { value: NonNullable<typeof b.value> } => b.value !== null);

  // Rows top to bottom: our variants, then a spacer, then published scores.
  const rows = [
    ...published.map((b) => ({ kind: "published" as const, label: b.name, b })),
    ...variants.map((v) => ({ kind: "variant" as const, label: VARIANT_SHORT[v.name] ?? v.name, v })),
  ];
  const yLabels = rows.map((r) =>
    r.kind === "variant" && r.v.name === serving ? `${r.label}  ◀ serving` : r.label,
  );

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">How reliable the model is</p>
      <h3 className="card-title">Discrimination, with its uncertainty</h3>
      <p className="text-xs text-gray-500 mt-1 mb-2 max-w-3xl">
        Area under the ROC curve (0.5 is chance, 1.0 perfect). Filled markers are this project&apos;s
        models on the {data?.n_test.toLocaleString() ?? "1,000"}-patient synthetic test set, with{" "}
        {data?.n_bootstraps ?? 500}-bootstrap 95% intervals; hollow markers are published scores on
        real cohorts, shown for orientation only (different patients and endpoints).
      </p>
      {error && <p className="text-xs text-rose-700">Model comparison unavailable ({error}).</p>}
      {data && (
        <div className="figure-plate px-1 pt-2">
          <Plot
            data={[
              {
                type: "scatter",
                mode: "markers",
                name: "Published, real cohorts",
                x: published.map((b) => b.value.mid),
                y: published.map((b) => b.name),
                error_x: {
                  type: "data",
                  symmetric: false,
                  array: published.map((b) => b.value.hi - b.value.mid),
                  arrayminus: published.map((b) => b.value.mid - b.value.lo),
                  color: COLORS.muted,
                  thickness: 2,
                  width: 0,
                },
                marker: {
                  symbol: "diamond-open",
                  size: 11,
                  color: COLORS.muted,
                  line: { width: 2, color: COLORS.muted },
                },
                customdata: published.map((b) => `${b.cohort} · ${b.endpoint}`),
                hovertemplate: "<b>%{y}</b><br>AUROC %{x:.2f}<br>%{customdata}<extra></extra>",
              },
              {
                type: "scatter",
                mode: "markers",
                name: "This project, synthetic test set",
                x: variants.map((v) => v.auroc),
                y: variants.map((v) => VARIANT_SHORT[v.name] ?? v.name),
                error_x: {
                  type: "data",
                  symmetric: false,
                  array: variants.map((v) => v.auroc_ci_hi - v.auroc),
                  arrayminus: variants.map((v) => v.auroc - v.auroc_ci_lo),
                  color: alpha(COLORS.ink, 0.55),
                  thickness: 2,
                  width: 7,
                },
                marker: {
                  size: variants.map((v) => (v.name === serving ? 17 : 12)),
                  color: variants.map((v) => VARIANT_COLOR[v.name] ?? COLORS.ibm),
                  line: {
                    color: variants.map((v) => (v.name === serving ? COLORS.ink : "#ffffff")),
                    width: variants.map((v) => (v.name === serving ? 2.5 : 1.5)),
                  },
                },
                customdata: variants.map(
                  (v) =>
                    `95% CI ${v.auroc_ci_lo.toFixed(3)} to ${v.auroc_ci_hi.toFixed(3)} · AUPRC ${v.auprc.toFixed(3)} · Brier ${v.brier.toFixed(4)}`,
                ),
                hovertemplate: "<b>%{y}</b><br>AUROC %{x:.3f}<br>%{customdata}<extra></extra>",
              },
            ]}
            layout={layout({
              height: 70 + rows.length * 34,
              margin: { l: 12, r: 20, t: 8, b: 48 },
              xaxis: { title: { text: "AUROC" }, range: [0.5, 0.9], dtick: 0.05 },
              yaxis: {
                categoryorder: "array",
                categoryarray: rows.map((r) => r.label),
                tickvals: rows.map((r) => r.label),
                ticktext: yLabels,
                tickfont: { size: 12, color: COLORS.ink, family: '"Times New Roman", Times, serif' },
                showgrid: false,
              },
              shapes: [
                // Divider between published scores and this project's models.
                {
                  type: "line",
                  xref: "paper",
                  yref: "y",
                  x0: 0,
                  x1: 1,
                  y0: published.length - 0.5,
                  y1: published.length - 0.5,
                  line: { color: COLORS.axis, width: 1, dash: "dot" },
                },
              ],
              legend: { orientation: "h", x: 0, y: -0.18 },
            })}
            config={config("auroc-forest")}
            style={{ width: "100%" }}
          />
        </div>
      )}
      <p className="text-[10px] text-gray-500 mt-2 leading-snug">
        &ldquo;Serving&rdquo; marks the model the API used for this case. As reported by{" "}
        <code>api/scripts/train_model_variants.py</code>, these AUROCs are computed after an isotonic
        calibrator fitted on the same test set. Source: <code>model_comparison.json</code>.
      </p>
    </div>
  );
}
