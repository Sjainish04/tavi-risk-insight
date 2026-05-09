import { Stethoscope } from "lucide-react";

import { usePrediction } from "@/store/prediction";

export function SpecialConsiderationsCard() {
  const result = usePrediction((s) => s.result);
  if (!result || result.device_assessments.length === 0) return null;

  // Aggregate considerations across devices, deduped
  const allConsiderations = Array.from(
    new Set(result.device_assessments.flatMap((d) => d.considerations)),
  );

  if (allConsiderations.length === 0) return null;

  return (
    <div className="ibm-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Stethoscope className="w-4 h-4 text-ibm-500" />
        <h3 className="text-sm font-semibold text-gray-900">Special considerations</h3>
      </div>
      <ul className="space-y-1.5 text-xs text-gray-700">
        {allConsiderations.map((c, i) => (
          <li key={i} className="flex gap-2 leading-snug">
            <span className="text-ibm-500 flex-shrink-0">·</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
