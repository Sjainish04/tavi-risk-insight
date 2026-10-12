import { Stethoscope } from "lucide-react";

import { cleanText } from "@/lib/utils";
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
      result.device_assessments.flatMap((d) => d.considerations.map((c) => cleanText(stripCitation(c)))),
    ),
  );

  if (allConsiderations.length === 0) return null;

  return (
    <div className="ibm-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-ibm-500" />
        <h3 className="card-title">Special considerations</h3>
      </div>
      <ul className="space-y-2 text-xs text-gray-700">
        {allConsiderations.map((c, i) => (
          <li
            key={i}
            className="flex gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 leading-snug"
          >
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ibm-500" />
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
