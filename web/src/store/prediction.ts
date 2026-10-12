import { create } from "zustand";

import { predict as apiPredict, streamExplain } from "@/lib/api";
import { demoPresets } from "@/lib/schema";
import type { ExplainRequest, PatientInput, RiskOutput } from "@/lib/types";

export type PresetKey = keyof typeof demoPresets;

interface PredictionState {
  loading: boolean;
  result: RiskOutput | null;
  lastInput: PatientInput | null;
  error: string | null;
  /** The input of the request in flight or last failed, so an error can retry it. */
  pendingInput: PatientInput | null;
  /** Set when a demo case is launched outside the form, so the form can load
   *  the same values; the nonce makes a repeat of the same case count. */
  presetKey: PresetKey | null;
  presetNonce: number;

  explanation: string;
  explanationLoading: boolean;
  explanationError: string | null;
  abortExplain: (() => void) | null;

  predict: (input: PatientInput) => Promise<void>;
  retry: () => Promise<void>;
  runPreset: (key: PresetKey) => Promise<void>;
  explain: () => void;
  cancelExplain: () => void;
  reset: () => void;
}

export const usePrediction = create<PredictionState>((set, get) => ({
  loading: false,
  result: null,
  lastInput: null,
  error: null,
  pendingInput: null,
  presetKey: null,
  presetNonce: 0,
  explanation: "",
  explanationLoading: false,
  explanationError: null,
  abortExplain: null,

  predict: async (input) => {
    set({
      loading: true,
      error: null,
      pendingInput: input,
      explanation: "",
      explanationError: null,
    });
    try {
      const result = await apiPredict(input);
      set({ result, lastInput: input, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  retry: async () => {
    const input = get().pendingInput;
    if (input) await get().predict(input);
  },

  runPreset: async (key) => {
    set((s) => ({ presetKey: key, presetNonce: s.presetNonce + 1 }));
    await get().predict(demoPresets[key].values as PatientInput);
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
