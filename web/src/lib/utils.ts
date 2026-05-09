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
