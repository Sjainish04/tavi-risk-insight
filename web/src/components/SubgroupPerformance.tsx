import { COLORS, Plot, alpha, config, layout } from "@/lib/plot";
import { type DcaFairnessReport, VARIANT_SHORT, servingVariant, useReport } from "@/lib/reports";
import { usePrediction } from "@/store/prediction";

const ORDER = ["v1_lgbm_baseline", "v2_lgbm_brdav", "v3_stacking"];

const SEX = [
  { key: "female", label: "Women", color: "#db2777" },
  { key: "male", label: "Men", color: "#2563eb" },
] as const;

const AGE = [
  { key: "age_lo", label: "Youngest third", color: "#0d9488" },
  { key: "age_mid", label: "Middle third", color: "#d97706" },
  { key: "age_hi", label: "Oldest third", color: "#7c3aed" },
] as const;

/** Does each model discriminate equally well across groups? AUROC by sex and by
 *  age tertile on the test set, from dca_fairness.json. The grey bar joining a
 *  model's group values is its gap: the longer it is, the less even the model. */
export function SubgroupPerformance() {
  const result = usePrediction((s) => s.result);
  const { data, error } = useReport<DcaFairnessReport>("/dca_fairness.json");
  const serving = result ? servingVariant(result.primary_model_name) : null;
  const names = ORDER.filter((n) => data?.fairness[n]);
  const rowLabel = (n: string) => `${VARIANT_SHORT[n] ?? n}${n === serving ? "  ◀ serving" : ""}`;

  // Group sizes and death counts, so the caption states how thin the groups are.
  const groupStats = names.length
    ? [
        ...Object.values(data!.fairness[names[0]].by_sex),
        ...Object.values(data!.fairness[names[0]].by_age),
      ]
    : [];
  const sizes = groupStats.map((g) => g.n);
  const deaths = groupStats.map((g) => Math.round(g.n * g.outcome_rate));

  const panel = (
    groups: readonly { key: string; label: string; color: string }[],
    pick: (n: string, key: string) => { auroc: number | null; n: number } | undefined,
    file: string,
  ) => {
    const spans = names.map((n) => {
      const values = groups.map((g) => pick(n, g.key)?.auroc).filter((v): v is number => v != null);
      return { n, lo: Math.min(...values), hi: Math.max(...values) };
    });
    return (
      <Plot
        data={[
          // The gap per model, as a thick translucent bar behind the dots.
          ...spans.map((s) => ({
            type: "scatter" as const,
            mode: "lines" as const,
            x: [s.lo, s.hi],
            y: [rowLabel(s.n), rowLabel(s.n)],
            line: { color: alpha(COLORS.muted, 0.35), width: 9 },
            hoverinfo: "skip" as const,
            showlegend: false,
          })),
          ...groups.map((g) => ({
            type: "scatter" as const,
            mode: "markers" as const,
            name: g.label,
            x: names.map((n) => pick(n, g.key)?.auroc ?? null),
            y: names.map(rowLabel),
            marker: { color: g.color, size: 13, line: { color: "#ffffff", width: 2 } },
            customdata: names.map((n) => pick(n, g.key)?.n ?? 0),
            hovertemplate: `<b>${g.label}</b><br>AUROC %{x:.3f}<br>n = %{customdata}<extra>%{y}</extra>`,
          })),
        ]}
        layout={layout({
          height: 220,
          margin: { l: 12, r: 16, t: 8, b: 64 },
          xaxis: { title: { text: "AUROC" }, range: [0.65, 0.86], dtick: 0.05 },
          yaxis: {
            categoryorder: "array",
            categoryarray: names.map(rowLabel),
            tickfont: { size: 12, color: COLORS.ink, family: '"Times New Roman", Times, serif' },
            showgrid: false,
          },
          legend: { orientation: "h", x: 0, y: -0.42 },
        })}
        config={config(file)}
        style={{ width: "100%" }}
      />
    );
  };

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">How reliable the model is</p>
      <h3 className="card-title">Does it work equally well for everyone?</h3>
      <p className="text-xs text-gray-500 mt-1 mb-2 max-w-3xl">
        Discrimination (AUROC) within each group on the {data?.n_test.toLocaleString() ?? "1,000"}
        -patient test set. The grey bar is the gap between groups for that model: shorter is more
        even.
        {sizes.length > 0 &&
          ` Groups hold ${Math.min(...sizes)} to ${Math.max(...sizes)} patients but only ${Math.min(...deaths)} to ${Math.max(...deaths)} deaths each, so gaps of a few hundredths are within noise.`}
      </p>
      {error && <p className="text-xs text-rose-700">Fairness report unavailable ({error}).</p>}
      {data && (
        <div className="grid gap-3 lg:grid-cols-2">
          <figure className="figure-plate m-0 px-1 pt-2">
            <figcaption className="px-3 pt-1 text-xs font-semibold text-gray-700">By sex</figcaption>
            {panel(SEX, (n, k) => data.fairness[n].by_sex[k as "female" | "male"], "auroc-by-sex")}
          </figure>
          <figure className="figure-plate m-0 px-1 pt-2">
            <figcaption className="px-3 pt-1 text-xs font-semibold text-gray-700">By age tertile</figcaption>
            {panel(
              AGE,
              (n, k) => data.fairness[n].by_age[k as "age_lo" | "age_mid" | "age_hi"],
              "auroc-by-age",
            )}
          </figure>
        </div>
      )}
      <p className="text-[10px] text-gray-500 mt-2 leading-snug">
        Source: <code>dca_fairness.json</code>, from <code>api/scripts/dca_and_fairness.py</code>.
        The full table, with error rates, is in Model Card, Validation.
      </p>
    </div>
  );
}
