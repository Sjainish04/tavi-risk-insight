import { create } from "zustand";

import { predict as apiPredict, streamExplain } from "@/lib/api";
import type { ExplainRequest, PatientInput, RiskOutput } from "@/lib/types";

interface PredictionState {
  loading: boolean;
  result: RiskOutput | null;
  lastInput: PatientInput | null;
  error: string | null;

  explanation: string;
  explanationLoading: boolean;
  explanationError: string | null;
  abortExplain: (() => void) | null;

  predict: (input: PatientInput) => Promise<void>;
  explain: () => void;
  cancelExplain: () => void;
  reset: () => void;
}

export const usePrediction = create<PredictionState>((set, get) => ({
  loading: false,
  result: null,
  lastInput: null,
  error: null,
  explanation: "",
  explanationLoading: false,
  explanationError: null,
  abortExplain: null,

  predict: async (input) => {
    set({ loading: true, error: null, explanation: "", explanationError: null });
    try {
      const result = await apiPredict(input);
      set({ result, lastInput: input, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  explain: () => {
    const { result, lastInput } = get();
    if (!result || !lastInput) return;
    get().cancelExplain();

    const payload: ExplainRequest = {
      features: { ...lastInput } as Record<string, number | string | boolean | null>,
      sts_prom_raw: result.sts_prom.raw_probability,
      sts_prom_recalibrated:
        result.sts_prom.recalibrated_probability ?? result.sts_prom.raw_probability,
      euroscore_ii: result.euroscore_ii.raw_probability,
      tvt: result.tvt.raw_probability,
      lgbm_probability: result.lgbm.raw_probability,
      shap_top5: result.shap_top5,
      miscalibration_zone: result.miscalibration_zone,
    };

    set({ explanation: "", explanationLoading: true, explanationError: null });
    const abort = streamExplain(
      payload,
      (token) => set((s) => ({ explanation: s.explanation + token })),
      () => set({ explanationLoading: false, abortExplain: null }),
      (err) =>
        set({
          explanationError: err.message,
          explanationLoading: false,
          abortExplain: null,
        }),
    );
    set({ abortExplain: abort });
  },

  cancelExplain: () => {
    const { abortExplain } = get();
    if (abortExplain) abortExplain();
    set({ abortExplain: null, explanationLoading: false });
  },

  reset: () =>
    set({
      result: null,
      lastInput: null,
      error: null,
      explanation: "",
      explanationError: null,
    }),
}));
