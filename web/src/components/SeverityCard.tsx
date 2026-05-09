import { Activity, AlertOctagon, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";
import type { SeverityClass } from "@/lib/types";

const CLASS_LABEL: Record<SeverityClass, string> = {
  severe: "Severe AS",
  very_severe: "Very severe AS",
  low_flow_low_gradient: "Low-flow / low-gradient severe AS",
  moderate: "Moderate AS",
  not_severe: "Mild or no AS",
};

const CLASS_BADGE: Record<SeverityClass, string> = {
  severe: "bg-amber-50 text-amber-800 border-amber-200",
  very_severe: "bg-red-50 text-red-800 border-red-200",
  low_flow_low_gradient: "bg-amber-50 text-amber-800 border-amber-200",
  moderate: "bg-gray-50 text-gray-700 border-gray-200",
  not_severe: "bg-gray-50 text-gray-700 border-gray-200",
};

export function SeverityCard() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;
  const sev = result.severity;
  const isSevere = sev.is_severe;

  return (
    <div className="ibm-card p-3">
      <div className="flex items-start gap-3">
        {isSevere ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertOctagon className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {isSevere ? "Severe AS confirmed" : "Severe AS not met"}
            </h3>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded-sm",
                CLASS_BADGE[sev.severity_class],
              )}
            >
              {CLASS_LABEL[sev.severity_class]}
            </span>
          </div>
          {sev.criteria_met.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
              {sev.criteria_met.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Activity className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
          {sev.notes && (
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">{sev.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
