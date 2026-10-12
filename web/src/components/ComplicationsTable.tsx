import { AlertCircle } from "lucide-react";

import { fmtPct } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";
import type { ProbabilityWithCI } from "@/lib/types";
import { InlineBar } from "./InlineBar";

interface Row {
  label: string;
  endpoint: ProbabilityWithCI;
  hint: string;
}

function multiplierColor(mult: number): string {
  if (mult <= 1.5) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (mult <= 2.5) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

/** Bar colour follows the same multiplier bands as the chip beside it. */
function multiplierHex(mult: number): string {
  if (mult <= 1.5) return "#059669";
  if (mult <= 2.5) return "#d97706";
  return "#e11d48";
}

export function ComplicationsTable() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;
  const c = result.complication_risks;

  const rows: Row[] = [
    {
      label: "Disabling stroke",
      endpoint: c.stroke_30d,
      hint: "30 d (VARC-3)",
    },
    {
      label: "Acute kidney injury (stage 2-3)",
      endpoint: c.aki_2_3_30d,
      hint: "30 d (VARC-3)",
    },
    {
      label: "Major vascular complication",
      endpoint: c.major_vascular_30d,
      hint: "30 d",
    },
    {
      label: "Life-threatening or major bleed",
      endpoint: c.life_threatening_bleed_30d,
      hint: "30 d",
    },
  ];

  // One scale for the whole column, so the four bars compare directly.
  const scaleMax = Math.max(...rows.map((r) => r.endpoint.hi), 0.01) * 1.15;

  return (
    <div className="ibm-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-ibm-500" />
        <h3 className="card-title">Procedural complication risks</h3>
      </div>
      <p className="text-[11px] text-gray-500 mb-2 leading-snug">
        VARC-3 endpoints. Multipliers are vs. cohort base rate (PARTNER 3 / Evolut Low Risk era).
        CI is ±25% of point estimate (heuristic).
      </p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <th className="text-left font-medium px-2 py-2">Endpoint</th>
              <th className="text-right font-medium px-2 py-2">Risk</th>
              <th className="font-medium px-2 py-2 w-[30%]">
                <span className="sr-only">Risk, drawn</span>
              </th>
              <th className="text-right font-medium px-2 py-2">95% CI</th>
              <th className="text-right font-medium px-2 py-2">vs base</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mult = r.endpoint.multiplier_vs_base;
              return (
                <tr key={r.label} className="border-b border-gray-100 last:border-0">
                  <td className="px-2 py-2.5">
                    <div className="font-medium text-gray-900">{r.label}</div>
                    <div className="text-[11px] text-gray-500">{r.hint}</div>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-semibold text-gray-900">
                    {fmtPct(r.endpoint.p)}
                  </td>
                  <td className="px-2 py-2.5">
                    <InlineBar
                      value={r.endpoint.p}
                      lo={r.endpoint.lo}
                      hi={r.endpoint.hi}
                      reference={r.endpoint.base_rate}
                      max={scaleMax}
                      color={multiplierHex(mult)}
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-gray-600 text-xs">
                    {fmtPct(r.endpoint.lo)} – {fmtPct(r.endpoint.hi)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span
                      className={`inline-block text-[11px] font-mono px-2 py-0.5 border rounded-full ${multiplierColor(
                        mult,
                      )}`}
                    >
                      {mult.toFixed(2)}×
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
        <span>Bar: estimate</span>
        <span>Whisker: 95% CI</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 rounded bg-ink-800" /> cohort base rate
        </span>
      </p>
    </div>
  );
}
