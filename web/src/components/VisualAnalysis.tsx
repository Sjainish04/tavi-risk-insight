import { BarChart3, Compass, Gauge, Microscope } from "lucide-react";

import { type ModelComparisonReport, VARIANT_SHORT, servingVariant, useReport } from "@/lib/reports";
import { fmtPct } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";
import { CohortPosition } from "./CohortPosition";
import { DiscriminationForest } from "./DiscriminationForest";
import { ModelCalibration } from "./ModelCalibration";
import { RiskFactorProfile } from "./RiskFactorProfile";
import { RiskDrivers } from "./RiskDrivers";
import { SensitivityAnalysis } from "./SensitivityAnalysis";
import { SubgroupPerformance } from "./SubgroupPerformance";
import { SurvivalCurve } from "./SurvivalCurve";

const SECTIONS = [
  { id: "va-why", label: "Why this risk", icon: Microscope },
  { id: "va-where", label: "Where this patient sits", icon: Compass },
  { id: "va-reliable", label: "How reliable the model is", icon: Gauge },
];

function SectionHeading({ id, index }: { id: string; index: number }) {
  const section = SECTIONS.find((s) => s.id === id)!;
  const Icon = section.icon;
  return (
    <div id={id} className="flex scroll-mt-24 items-center gap-2.5 pt-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ibm-500 text-white shadow-glow">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="text-base font-bold text-gray-900">
        <span className="mr-1.5 font-mono text-ibm-600">{index}.</span>
        {section.label}
      </h3>
      <span className="ml-2 h-px flex-1 bg-gradient-to-r from-slate-300 to-transparent" />
    </div>
  );
}

/** The Visual analysis tab: one patient's risk explained, placed in the cohort,
 *  and qualified by how well the model performs, in that order. */
export function VisualAnalysis() {
  const result = usePrediction((s) => s.result);
  const { data: comparison } = useReport<ModelComparisonReport>("/model_comparison.json");
  if (!result) return null;

  const serving = servingVariant(result.primary_model_name);
  const servingMetrics = comparison?.variants.find((v) => v.name === serving);
  const modelName = result.primary_model_name.startsWith("v3") ? "Stacking ensemble" : "LightGBM";

  const tiles = [
    {
      label: "Predicted 30-day mortality",
      value: fmtPct(result.lgbm.raw_probability),
      hint: `${modelName}, CI ${fmtPct(result.lgbm_ci[0])} to ${fmtPct(result.lgbm_ci[1])}`,
    },
    {
      label: "Against the cohort base rate",
      value: `${result.lgbm_base_rate_comparison.toFixed(2)}×`,
      hint: result.lgbm_base_rate_comparison >= 1 ? "above the base rate" : "below the base rate",
    },
    {
      label: "Risk decile",
      value: `${result.lgbm_decile} of 9`,
      hint: "0 is the lowest-risk tenth of the cohort",
    },
    {
      label: "Serving model AUROC",
      value: servingMetrics ? servingMetrics.auroc.toFixed(3) : "n/a",
      hint: servingMetrics
        ? `${VARIANT_SHORT[serving]}, 95% CI ${servingMetrics.auroc_ci_lo.toFixed(2)} to ${servingMetrics.auroc_ci_hi.toFixed(2)}`
        : "loading the evaluation report",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="ibm-card relative overflow-hidden p-5">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ibm-400 via-ibm-600 to-ibm-800"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ibm-50 text-ibm-600 ring-1 ring-ibm-100">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Visual analysis</p>
              <h2 className="card-title">This patient&apos;s risk, explained and qualified</h2>
            </div>
          </div>
          <nav aria-label="Visual analysis sections" className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-full border border-ibm-200 bg-ibm-50 px-3 py-1 text-xs font-medium text-ibm-700 transition-colors hover:bg-ibm-100"
              >
                {i + 1}. {s.label}
              </a>
            ))}
          </nav>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{t.label}</dt>
              <dd className="mt-1 font-mono text-xl font-semibold text-gray-900">{t.value}</dd>
              <dd className="mt-0.5 text-[11px] leading-snug text-gray-500">{t.hint}</dd>
            </div>
          ))}
        </dl>
      </div>

      <SectionHeading id="va-why" index={1} />
      <RiskDrivers />
      <div className="grid gap-4 xl:grid-cols-2">
        <RiskFactorProfile />
        <SensitivityAnalysis />
      </div>

      <SectionHeading id="va-where" index={2} />
      <CohortPosition />
      <SurvivalCurve />

      <SectionHeading id="va-reliable" index={3} />
      <div className="grid gap-4 xl:grid-cols-2">
        <DiscriminationForest />
        <ModelCalibration />
      </div>
      <SubgroupPerformance />
    </div>
  );
}
