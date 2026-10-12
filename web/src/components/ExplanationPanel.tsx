import { Sparkles, StopCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { type HealthInfo, getHealth } from "@/lib/api";
import { cleanText } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

const PROVIDER_LABEL: Record<string, string> = {
  watsonx: "IBM Granite-4 H-Small · watsonx.ai (us-south) · Granite Guardian filtered",
  featherless: "BioMistral-7B · Featherless AI",
  huggingface: "Hugging Face Inference",
  ollama: "ollama (local)",
  premium: "OpenAI / Anthropic",
};

export function ExplanationPanel() {
  const result = usePrediction((s) => s.result);
  const explanation = usePrediction((s) => s.explanation);
  const loading = usePrediction((s) => s.explanationLoading);
  const error = usePrediction((s) => s.explanationError);
  const explain = usePrediction((s) => s.explain);
  const cancel = usePrediction((s) => s.cancelExplain);

  const [health, setHealth] = useState<HealthInfo | null>(null);
  useEffect(() => {
    getHealth().then(setHealth).catch(() => undefined);
  }, []);

  if (!result) return null;

  const providerLabel = health
    ? (PROVIDER_LABEL[health.llm_provider] ?? health.llm_provider)
    : "loading…";

  return (
    <div className="ibm-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="card-title flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ibm-500" />
          Heart Team note
        </h3>
        {loading ? (
          <button
            onClick={cancel}
            className="ibm-btn-secondary text-xs"
            type="button"
          >
            <StopCircle className="w-3 h-3 mr-1" />
            Stop
          </button>
        ) : (
          <button
            onClick={explain}
            className="ibm-btn-primary text-xs"
            type="button"
          >
            {explanation ? "Regenerate" : "Generate explanation"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
          {error}
        </p>
      )}

      <div className="figure-plate min-h-[160px] p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
        {(explanation && cleanText(explanation)) ||
          (loading
            ? "Writing the note…"
            : 'Click "Generate explanation" to stream a clinical summary for the Heart Team.')}
      </div>

      <p className="text-xs text-gray-500">
        Streamed from <span className="font-medium">{providerLabel}</span>.
        Production deployment target: IBM watsonx.ai Granite-3-8B with Granite Guardian safety filtering.
      </p>
    </div>
  );
}
