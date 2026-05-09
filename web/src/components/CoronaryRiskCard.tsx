import { HeartPulse } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";
import type { CoronaryRiskGrade } from "@/lib/types";

const GRADE_BADGE: Record<CoronaryRiskGrade, string> = {
  low: "bg-emerald-50 text-emerald-800 border-emerald-200",
  intermediate: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-red-50 text-red-800 border-red-200",
};

const GRADE_LABEL: Record<CoronaryRiskGrade, string> = {
  low: "Low",
  intermediate: "Intermediate",
  high: "High",
};

export function CoronaryRiskCard() {
  const result = usePrediction((s) => s.result);
  if (!result || result.device_assessments.length === 0) return null;

  return (
    <div className="ibm-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <HeartPulse className="w-4 h-4 text-ibm-500" />
        <h3 className="text-sm font-semibold text-gray-900">
          Coronary obstruction risk · per device
        </h3>
      </div>
      <p className="text-[11px] text-gray-500 mb-2 leading-snug">
        Graded from coronary heights and sinus of Valsalva diameter (Ribeiro 2013, Yamamoto 2014).
        Self-expanding supra-annular thresholds shifted +2 mm.
      </p>
      <div className="space-y-2">
        {result.device_assessments.map((d) => (
          <div
            key={d.valve}
            className="flex items-start justify-between gap-3 border-b border-gray-100 last:border-0 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-900">{d.valve}</div>
              {d.coronary_risk.reasons.length > 0 && (
                <ul className="text-[11px] text-gray-600 mt-0.5 leading-snug list-disc pl-4">
                  {d.coronary_risk.reasons.slice(0, 3).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded-sm whitespace-nowrap",
                GRADE_BADGE[d.coronary_risk.grade],
              )}
            >
              {GRADE_LABEL[d.coronary_risk.grade]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
