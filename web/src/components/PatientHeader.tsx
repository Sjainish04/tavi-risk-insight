import { Calendar, Hash, User2 } from "lucide-react";

import type { PatientInput } from "@/lib/types";
import { usePrediction } from "@/store/prediction";

const NYHA_LABEL: Record<string, string> = {
  I: "I — asymptomatic",
  II: "II — slight limitation",
  III: "III — marked limitation",
  IV: "IV — symptoms at rest",
};

interface Props {
  values: PatientInput;
  caseId: string;
}

export function PatientHeader({ values, caseId }: Props) {
  const result = usePrediction((s) => s.result);
  const recal = result?.sts_prom.recalibrated_probability ?? null;

  return (
    <div className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <Cell icon={<Hash className="w-3.5 h-3.5" />} label="Case">
          {caseId}
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
          <span className="ml-auto bg-ibm-500 text-white px-2 py-0.5 font-mono font-medium">
            30-day risk · {(recal * 100).toFixed(1)}%
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
      {icon}
      <span className="text-gray-400">{label}</span>
      <span className={capitalize ? "capitalize text-white" : "text-white"}>
        {children}
      </span>
    </span>
  );
}
