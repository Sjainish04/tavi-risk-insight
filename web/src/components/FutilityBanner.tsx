import { OctagonAlert } from "lucide-react";

import { usePrediction } from "@/store/prediction";

export function FutilityBanner() {
  const result = usePrediction((s) => s.result);
  if (!result?.futility?.is_futile) return null;
  const f = result.futility;

  return (
    <div className="ibm-card border-amber-300 bg-amber-50 p-4 flex gap-3">
      <OctagonAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-amber-900 mb-1">
          Futility flag — composite score {f.composite_score.toFixed(2)} ≥ 0.50
        </h3>
        <p className="text-sm text-amber-900 leading-relaxed">
          {f.alternative}
        </p>
        {f.drivers.length > 0 && (
          <p className="text-xs text-amber-900 mt-1.5 leading-snug">
            <strong>Drivers:</strong> {f.drivers.join(" · ")}
          </p>
        )}
        <p className="text-[11px] text-amber-800 mt-1.5 leading-snug">
          {f.evidence}
        </p>
      </div>
    </div>
  );
}
