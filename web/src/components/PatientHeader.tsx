import { Calendar, Hash, User2 } from "lucide-react";

import type { PatientInput } from "@/lib/types";
import { usePrediction } from "@/store/prediction";

const NYHA_LABEL: Record<string, string> = {
  I: "I (asymptomatic)",
  II: "II (slight limitation)",
  III: "III (marked limitation)",
  IV: "IV (symptoms at rest)",
};

interface Props {
  values: PatientInput;
  caseId: string;
}

export function PatientHeader({ values, caseId }: Props) {
  const result = usePrediction((s) => s.result);
  const recal = result?.sts_prom.recalibrated_probability ?? null;

  return (
    <div className="bg-gradient-to-r from-ink-900 via-ink-800 to-ibm-900 text-white shadow-lift">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        <Cell icon={<Hash className="w-3.5 h-3.5" />} label="Case">
          <span className="font-mono">{caseId}</span>
        </Cell>
        <Cell icon={<User2 className="w-3.5 h-3.5" />} label="Patient">
          {`${values.sex === "female" ? "F" : "M"} · ${Math.round(values.age_years)} yo`}
        </Cell>
        <Cell label="BMI">{values.bmi.toFixed(1)} kg/m²</Cell>
        <Cell label="LVEF">{Math.round(values.lvef_pct)}%</Cell>
        <Cell label="eGFR">{Math.round(values.egfr)}</Cell>
        <Cell label="NYHA">{NYHA_LABEL[values.nyha_class] ?? values.nyha_class}</Cell>
        <Cell label="Status" capitalize>
          {values.urgency}
        </Cell>
        <Cell icon={<Calendar className="w-3.5 h-3.5" />} label="Heart Team">
          Today · pending review
        </Cell>
        {recal != null && (
          <span
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/25"
            title="30-day mortality from the era-recalibrated STS-PROM. Other models are compared on the Risk tab."
          >
            <span className="text-slate-300">STS-PROM, recalibrated</span>
            <span className="font-mono font-semibold text-white">
              {(recal * 100).toFixed(1)}%
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  icon,
  children,
  capitalize,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  capitalize?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}</span>
      <span className={capitalize ? "capitalize text-white" : "text-white"}>{children}</span>
    </span>
  );
}
