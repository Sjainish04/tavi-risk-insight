import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import { cleanText } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

/** 502/503/504 or a dropped connection: the free-tier backend is asleep or
 *  starting. Anything else is a real error and is shown as such. */
function isColdStart(message: string): boolean {
  return /^(502|503|504)\b/.test(message) || /Failed to fetch|NetworkError|Load failed/i.test(message);
}

/** Progress while a case runs. After a few seconds it says why it may be slow. */
export function LoadingState() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="ibm-card p-6" role="status">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-ibm-500" />
        <p className="text-sm font-semibold text-gray-900">Running the Heart Team analysis…</p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-ibm-400 to-ibm-600" />
      </div>
      {slow && (
        <p className="mt-3 text-xs leading-relaxed text-gray-600">
          The analysis server sleeps when nobody is using it and takes up to a minute to
          wake. The first case after a quiet spell is slow; the next ones take a couple of
          seconds.
        </p>
      )}
    </div>
  );
}

/** A failed request, explained, with a retry of the same input. */
export function ErrorState({ message }: { message: string }) {
  const retry = usePrediction((s) => s.retry);
  const loading = usePrediction((s) => s.loading);
  const cold = isColdStart(message);
  return (
    <div className="ibm-card border-amber-300 bg-amber-50/70 p-4" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950">
            {cold ? "The analysis server is starting up" : "The analysis could not be completed"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">
            {cold
              ? "It sleeps when idle and needs up to a minute to wake. Try again shortly; nothing you entered has been lost."
              : "The server returned an error for this case. Check the inputs and try again."}
          </p>
          <p className="mt-2 break-words font-mono text-[11px] text-amber-800/90">{cleanText(message)}</p>
          <button
            type="button"
            onClick={() => retry()}
            disabled={loading}
            className="ibm-btn-primary mt-3 px-3 py-1.5"
          >
            <RotateCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {loading ? "Retrying…" : "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}
