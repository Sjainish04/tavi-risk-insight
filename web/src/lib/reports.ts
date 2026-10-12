import { useEffect, useState } from "react";

/** Offline evaluation reports shipped in web/public, written by the scripts in
 *  api/scripts (train_model_variants.py, dca_and_fairness.py,
 *  analyze_brdav_vs_recal.py). Only the fields the figures read are typed. */

export interface CalibrationPoint {
  decile: number;
  n: number;
  pred_mean: number;
  actual_mortality: number;
}

export interface VariantMetrics {
  name: string;
  label: string;
  skipped?: boolean;
  auroc: number;
  auroc_ci_lo: number;
  auroc_ci_hi: number;
  auprc: number;
  brier: number;
  calibration_curve: CalibrationPoint[];
  calibration_raw_o_over_e: number;
}

export interface Benchmark {
  name: string;
  cohort: string;
  auroc: string;
  endpoint: string;
  url: string;
}

export interface ModelComparisonReport {
  n_test: number;
  base_rate: number;
  n_bootstraps: number;
  variants: VariantMetrics[];
  external_benchmarks: Benchmark[];
}

export interface GroupStats {
  n: number;
  outcome_rate: number;
  auroc: number | null;
}

export interface FairnessVariant {
  by_sex: { female: GroupStats; male: GroupStats };
  by_age: { age_lo: GroupStats; age_mid: GroupStats; age_hi: GroupStats };
}

export interface DcaFairnessReport {
  n_test: number;
  fairness: Record<string, FairnessVariant>;
}

export interface CohortSamplePoint {
  sts_recal: number;
  lgbm_30d: number;
  brdav_followup: number;
  outcome_30d_mortality: number;
}

export interface CohortReport {
  n_patients: number;
  outcome_30d_mortality_observed: number;
  scatter_sample: CohortSamplePoint[];
}

const cache = new Map<string, Promise<unknown>>();

/** Fetches a report once per page load and shares it between every figure that
 *  reads it. `null` while loading; an error leaves it null and is reported. */
export function useReport<T>(path: string): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!cache.has(path)) {
      cache.set(
        path,
        fetch(path).then((r) => {
          if (!r.ok) throw new Error(`${r.status} loading ${path}`);
          return r.json();
        }),
      );
    }
    (cache.get(path) as Promise<T>)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        cache.delete(path);
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return { data, error };
}

/** Readable names for the offline model variants. */
export const VARIANT_SHORT: Record<string, string> = {
  v1_lgbm_baseline: "v1 LightGBM",
  v2_lgbm_brdav: "v2 LightGBM + oracle",
  v3_stacking: "v3 stacking ensemble",
  v4_tabpfn: "v4 TabPFN (cloud)",
};

/** One colour per variant, shared by every figure that compares them. */
export const VARIANT_COLORS: Record<string, string> = {
  v1_lgbm_baseline: "#0f62fe",
  v2_lgbm_brdav: "#65a30d",
  v3_stacking: "#9333ea",
  v4_tabpfn: "#0d9488",
};

/** Which offline variant the live API is serving, from /predict's
 *  primary_model_name ("v1_lgbm" or "v3_stacking_brdav"). */
export function servingVariant(primaryModelName: string): string {
  return primaryModelName.startsWith("v3") ? "v3_stacking" : "v1_lgbm_baseline";
}
