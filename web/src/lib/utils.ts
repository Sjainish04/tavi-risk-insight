import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merger — combines clsx and tailwind-merge. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a 0–1 probability as a percentage with 1 decimal. */
export function fmtPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/** Format a SHAP value as a signed number with 3 decimals. */
export function fmtShap(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(3)}`;
}

/** Clinical 30-day mortality risk band (STS-PROM convention). */
export type RiskBand = "low" | "intermediate" | "high";

export function riskBand(p: number): RiskBand {
  if (p < 0.04) return "low";
  if (p < 0.08) return "intermediate";
  return "high";
}

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  low: "Low risk",
  intermediate: "Intermediate risk",
  high: "High risk",
};

/** Tailwind classes for a risk-band chip (background + text + border). */
export const RISK_BAND_CHIP: Record<RiskBand, string> = {
  low: "bg-emerald-50 text-emerald-800 border-emerald-200",
  intermediate: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-red-50 text-red-800 border-red-200",
};

/** Tailwind text-color class for plain (non-chip) risk colouring. */
export const RISK_BAND_TEXT: Record<RiskBand, string> = {
  low: "text-emerald-700",
  intermediate: "text-amber-700",
  high: "text-red-700",
};
