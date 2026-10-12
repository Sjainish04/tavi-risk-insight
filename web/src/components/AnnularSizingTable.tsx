import { Cpu, Info, Trophy } from "lucide-react";

import type { DeviceAssessment } from "@/lib/types";
import { cleanText, cn, fmtPct } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";
import { InlineBar } from "./InlineBar";

const VALVE_CLASS_LABEL: Record<DeviceAssessment["valve_class"], string> = {
  "balloon-expandable": "Balloon-expandable",
  "self-expanding-supra-annular": "Self-expanding · supra-annular",
  "self-expanding-intra-annular": "Self-expanding · intra-annular",
};

function compositeRisk(d: DeviceAssessment): number {
  // Weighted composite: mortality dominates, PVL meaningful, PPM weighted lower
  return (
    d.predicted_mortality_30d * 5 +
    d.predicted_pvl_moderate * 2 +
    d.predicted_ppm_30d * 1
  );
}

export function AnnularSizingTable() {
  const result = usePrediction((s) => s.result);
  if (!result || result.device_assessments.length === 0) return null;
  const devices = result.device_assessments;

  // Best fit only among devices that are sized in-range
  const inRange = devices
    .map((d, i) => [i, compositeRisk(d)] as [number, number])
    .filter(([i]) => devices[i].sizing.in_range);
  const bestIdx =
    inRange.length > 0
      ? inRange.reduce((acc, cur) => (cur[1] < acc[1] ? cur : acc))[0]
      : -1;

  const noneInRange = bestIdx === -1;
  // Shared scales so the three devices' bars compare directly.
  const ppmMax = Math.max(...devices.map((d) => d.predicted_ppm_30d), 0.01) * 1.15;
  const pvlMax = Math.max(...devices.map((d) => d.predicted_pvl_moderate), 0.01) * 1.15;

  return (
    <div className="ibm-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="card-title flex items-center gap-2">
            <Cpu className="w-4 h-4 text-ibm-500" />
            Per-device assessment · sizing + complications
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Recommended valve size from manufacturer IFU; complication estimates from VARC-3
            baselines × patient modifiers. Lowest-composite-risk highlighted only among sizes
            in published range. Final device choice is at Heart Team discretion.
          </p>
        </div>
        {!result.has_ct_inputs && (
          <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
            CT pending
          </span>
        )}
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
              <th className="text-left font-medium px-2 py-2">Device</th>
              <th className="text-left font-medium px-2 py-2">Recommended size</th>
              <th className="text-right font-medium px-2 py-2">Oversize</th>
              <th className="text-right font-medium px-2 py-2">30-d mortality</th>
              <th className="text-right font-medium px-2 py-2">PPM &lt; 30 d</th>
              <th className="text-right font-medium px-2 py-2">Mod+ PVL</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d, i) => (
              <tr
                key={d.valve}
                className={cn(
                  "border-b border-gray-100 last:border-0",
                  i === bestIdx && "bg-gradient-to-r from-ibm-50 to-transparent",
                )}
              >
                <td className="px-2 py-3">
                  <div className="flex items-start gap-2">
                    {i === bestIdx && (
                      <Trophy className="w-3.5 h-3.5 text-ibm-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {d.valve}
                        {i === bestIdx && (
                          <span className="ml-2 align-middle text-[9px] font-semibold uppercase tracking-wider text-white bg-ibm-500 px-1.5 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {VALVE_CLASS_LABEL[d.valve_class]}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-gray-900">
                  {d.sizing.recommended_size_mm ? (
                    <span className="font-mono">{d.sizing.recommended_size_mm} mm</span>
                  ) : (
                    <span className="text-amber-700 text-xs">n/a</span>
                  )}
                  <div className="text-[11px] text-gray-500 leading-snug">
                    {d.sizing.in_range ? "in range" : "outside range"}
                  </div>
                </td>
                <td className="px-2 py-3 text-right font-mono text-gray-700 text-xs">
                  {d.sizing.oversizing_pct == null ? "n/a" : `${d.sizing.oversizing_pct}%`}
                </td>
                <td className="px-2 py-3 text-right font-mono text-gray-900">
                  {fmtPct(d.predicted_mortality_30d)}
                </td>
                <td className="px-2 py-3 text-right font-mono text-gray-900">
                  {fmtPct(d.predicted_ppm_30d)}
                  <span className="mt-1 block">
                    <InlineBar value={d.predicted_ppm_30d} max={ppmMax} color="#7c3aed" />
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-mono text-gray-900">
                  {fmtPct(d.predicted_pvl_moderate)}
                  <span className="mt-1 block">
                    <InlineBar value={d.predicted_pvl_moderate} max={pvlMax} color="#0d9488" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {noneInRange && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-800 mb-1">
            <Info className="w-3 h-3" />
            No device in published sizing range
          </div>
          <p className="text-xs text-amber-900 leading-snug">
            Annulus is outside the IFU range for all three FDA-cleared families; Heart Team
            review required. Consider explant SAVR, larger-than-published off-label sizing
            with operator experience, or alternative center referral.
          </p>
        </div>
      )}

      {!noneInRange && devices[bestIdx].sizing.note && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500 mb-1">
            <Info className="w-3 h-3" />
            Sizing note · {devices[bestIdx].valve}
          </div>
          <p className="text-xs text-gray-700 leading-snug">{cleanText(devices[bestIdx].sizing.note)}</p>
        </div>
      )}
    </div>
  );
}
