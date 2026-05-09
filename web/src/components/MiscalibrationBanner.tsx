import { AlertTriangle } from "lucide-react";

import { usePrediction } from "@/store/prediction";

export function MiscalibrationBanner() {
  const result = usePrediction((s) => s.result);
  if (!result?.miscalibration_zone) return null;

  return (
    <div className="ibm-card border-amber-300 bg-amber-50 p-4 flex gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="text-sm font-semibold text-amber-900 mb-1">
          STS-PROM miscalibration zone
        </h3>
        <p className="text-sm text-amber-900">
          {result.miscalibration_message ??
            "Raw STS-PROM differs materially from era-recalibrated estimate."}
        </p>
      </div>
    </div>
  );
}
