import { Stethoscope } from "lucide-react";

import { usePrediction } from "@/store/prediction";

// Strip inline parenthetical citations (e.g., " (Yoon 2017)") for the main view
function stripCitation(s: string): string {
  return s.replace(/\s*\(([^)]*\d{4}[^)]*)\)\s*/g, " ").trim();
}

export function SpecialConsiderationsCard() {
  const result = usePrediction((s) => s.result);
  if (!result || result.device_assessments.length === 0) return null;

  // Aggregate considerations across devices, deduped, citations stripped
  const allConsiderations = Array.from(
    new Set(
      result.device_assessments.flatMap((d) => d.considerations.map(stripCitation)),
    ),
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
      <p className="text-[10px] text-gray-400 mt-2 italic">
        Sources for each rule are in the Model Card.
      </p>
    </div>
  );
}
