import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Star,
  Wrench,
} from "lucide-react";

import type { DeviceAssessment, ProbabilityWithCI } from "@/lib/types";
import { RiskBandScale } from "./RiskBandScale";
import { RISK_BAND_CHIP, RISK_BAND_LABEL, cn, fmtPct, riskBand } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";
import type { WorkspaceView } from "./WorkspaceNav";

const SEVERITY_LABEL = {
  severe: "Severe AS confirmed",
  very_severe: "Very severe AS confirmed",
  low_flow_low_gradient: "Low-flow / low-gradient severe AS",
  moderate: "Moderate AS",
  not_severe: "AS not severe",
} as const;

interface NamedComp {
  name: string;
  c: ProbabilityWithCI;
}

function compositeRisk(d: DeviceAssessment): number {
  return (
    d.predicted_mortality_30d * 5 +
    d.predicted_pvl_moderate * 2 +
    d.predicted_ppm_30d * 1
  );
}

function pickRecommendedDevice(devices: DeviceAssessment[]): DeviceAssessment | null {
  const inRange = devices.filter((d) => d.sizing.in_range);
  if (inRange.length === 0) return null;
  return inRange.reduce((best, d) =>
    compositeRisk(d) < compositeRisk(best) ? d : best,
  );
}

function topElevatedComplications(
  result: ReturnType<typeof usePrediction.getState>["result"],
): NamedComp[] {
  if (!result) return [];
  const all: NamedComp[] = [
    { name: "Stroke", c: result.complication_risks.stroke_30d },
    { name: "AKI", c: result.complication_risks.aki_2_3_30d },
    { name: "Vascular", c: result.complication_risks.major_vascular_30d },
    { name: "Bleed", c: result.complication_risks.life_threatening_bleed_30d },
  ];
  return all
    .filter((x) => x.c.multiplier_vs_base >= 2.0)
    .sort((a, b) => b.c.multiplier_vs_base - a.c.multiplier_vs_base)
    .slice(0, 2);
}

function SummaryRow({
  label,
  children,
  emphasis,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-4 sm:items-baseline py-2.5 border-b border-slate-100 last:border-0">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={cn("text-sm leading-snug", emphasis ? "text-gray-900" : "text-gray-800")}>
        {children}
      </div>
    </div>
  );
}

function JumpLink({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-ibm-50 text-ibm-700 hover:bg-ibm-100 hover:-translate-y-px border border-ibm-200 rounded-full transition-all"
    >
      {label}
      <ArrowRight className="w-3 h-3" />
    </button>
  );
}

interface Props {
  onNavigate?: (v: WorkspaceView) => void;
}

export function HeartTeamSummary({ onNavigate }: Props) {
  const result = usePrediction((s) => s.result);
  if (!result) return null;

  const sev = result.severity;
  const elevated = topElevatedComplications(result);
  const recommended = pickRecommendedDevice(result.device_assessments);
  const topModifiable =
    result.risk_score_drivers.find((d) => d.is_modifiable && d.effect === "increases") ?? null;

  const echoChips = [
    `AVA ${result.feature_summary["aortic_valve_area_cm2"]?.toString().slice(0, 4) ?? "n/a"}`,
    `MG ${result.feature_summary["mean_aortic_gradient_mmhg"]?.toString().slice(0, 3) ?? "n/a"}`,
    `Vel ${result.feature_summary["peak_aortic_velocity_m_per_s"]?.toString().slice(0, 4) ?? "n/a"}`,
  ];
  const primaryName =
    result.primary_model_name === "v3_stacking_brdav" ? "Stacking ensemble" : "LightGBM";

  return (
    <div className="ibm-card relative overflow-hidden p-5 space-y-1 animate-fade-up">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-ibm-400 via-ibm-600 to-ibm-800"
      />
      <div className="flex items-center gap-2.5 mb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ibm-50 ring-1 ring-ibm-100">
          <Star className="w-4 h-4 text-ibm-500 fill-ibm-500" />
        </span>
        <div>
          <p className="eyebrow">At a glance</p>
          <h2 className="card-title">Heart Team summary</h2>
        </div>
      </div>

      <SummaryRow label="Severity" emphasis>
        <div className="flex items-center gap-2 flex-wrap">
          {sev.is_severe ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <span className="font-medium">{SEVERITY_LABEL[sev.severity_class]}</span>
          <span className="text-xs text-gray-500">{echoChips.join(" · ")}</span>
        </div>
      </SummaryRow>

      <SummaryRow label="30-day mortality" emphasis>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xl font-mono font-semibold text-gray-900">
            {fmtPct(result.lgbm.raw_probability)}
          </span>
          <span className="text-[11px] text-gray-500">{primaryName}</span>
          <span
            className={cn(
              "text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 border rounded-sm",
              RISK_BAND_CHIP[riskBand(result.lgbm.raw_probability)],
            )}
          >
            {RISK_BAND_LABEL[riskBand(result.lgbm.raw_probability)]}
          </span>
          <span className="text-xs text-gray-600 font-mono">
            CI {fmtPct(result.lgbm_ci[0])}–{fmtPct(result.lgbm_ci[1])}
          </span>
          <span className="text-[11px] font-mono px-1.5 py-px bg-gray-100 text-gray-700 rounded-sm">
            decile {result.lgbm_decile}/9
          </span>
          <span className="text-[11px] font-mono px-1.5 py-px bg-ibm-50 text-ibm-700 rounded-sm">
            {result.lgbm_base_rate_comparison.toFixed(2)}× base rate
          </span>
        </div>
      </SummaryRow>

      <SummaryRow label="All risk models">
        <RiskBandScale compact />
      </SummaryRow>

      <SummaryRow label="Recommended fit">
        {recommended ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Cpu className="w-3.5 h-3.5 text-ibm-600 flex-shrink-0" />
            <span className="font-medium text-gray-900">{recommended.valve}</span>
            {recommended.sizing.recommended_size_mm && (
              <span className="font-mono text-gray-700">
                · {recommended.sizing.recommended_size_mm} mm
              </span>
            )}
            <span className="text-[11px] text-gray-500">lowest combined risk · in range</span>
          </div>
        ) : (
          <span className="text-amber-700">
            No device fits the published sizing range; Heart Team review.
          </span>
        )}
      </SummaryRow>

      <SummaryRow label="Watch for">
        {elevated.length === 0 ? (
          <span className="text-gray-500">No complication above 2× the cohort base rate</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {elevated.map((e) => (
              <span
                key={e.name}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full"
              >
                <AlertTriangle className="w-3 h-3" />
                {e.name} {fmtPct(e.c.p)} · {e.c.multiplier_vs_base.toFixed(1)}× base
              </span>
            ))}
          </div>
        )}
      </SummaryRow>

      <SummaryRow label="Modifiable">
        {topModifiable ? (
          <div className="flex items-start gap-2">
            <Wrench className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-gray-900">{topModifiable.feature_label}</span>
              {topModifiable.modify_to && (
                <span className="text-amber-800"> → target {topModifiable.modify_to}</span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-gray-500">No modifiable driver flagged</span>
        )}
      </SummaryRow>

      {onNavigate && (
        <div className="pt-3 mt-2 border-t border-slate-100">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
            Need details?
          </p>
          <div className="flex flex-wrap gap-1.5">
            <JumpLink onClick={() => onNavigate("triage")} label="Triage" />
            <JumpLink onClick={() => onNavigate("risk")} label="Risk + complications" />
            <JumpLink onClick={() => onNavigate("devices")} label="Device sizing" />
            <JumpLink onClick={() => onNavigate("note")} label="Heart Team note" />
          </div>
        </div>
      )}
    </div>
  );
}
