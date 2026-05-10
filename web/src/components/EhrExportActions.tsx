import { Check, ClipboardCopy, FileDown } from "lucide-react";
import { useState } from "react";

import type { DeviceAssessment, RiskOutput } from "@/lib/types";
import { fmtPct } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

function compositeRisk(d: DeviceAssessment): number {
  return (
    d.predicted_mortality_30d * 5 +
    d.predicted_pvl_moderate * 2 +
    d.predicted_ppm_30d * 1
  );
}

function pickRecommendedDevice(devices: DeviceAssessment[]): DeviceAssessment | null {
  const inRange = devices.filter((d) => d.sizing.in_range);
  if (inRange.length === 0) return null;
  return inRange.reduce((best, d) => (compositeRisk(d) < compositeRisk(best) ? d : best));
}

function buildEhrText(result: RiskOutput, llmNote: string): string {
  const lines: string[] = [];
  lines.push("TAVI Heart Team note (auto-generated)");
  lines.push("=".repeat(40));
  lines.push("");
  lines.push("AS severity:");
  lines.push(`  ${result.severity.severity_class.replace(/_/g, " ")}`);
  for (const c of result.severity.criteria_met) lines.push(`    - ${c}`);
  lines.push("");

  if (result.futility.is_futile) {
    lines.push(`Futility flag RAISED (composite ${result.futility.composite_score.toFixed(2)}).`);
    lines.push("Alternative: medical therapy. SAVR is not the alternative here.");
    lines.push(`Drivers: ${result.futility.drivers.join("; ")}`);
    lines.push("");
  }

  lines.push("30-day mortality estimates:");
  lines.push(`  STS-PROM raw         ${fmtPct(result.sts_prom.raw_probability)}`);
  lines.push(
    `  STS-PROM era-adj     ${fmtPct(result.sts_prom.recalibrated_probability ?? result.sts_prom.raw_probability)}`,
  );
  lines.push(`  ACC/STS TVT          ${fmtPct(result.tvt.raw_probability)}`);
  lines.push(
    `  ML model             ${fmtPct(result.lgbm.raw_probability)}  ` +
      `(95% CI ${fmtPct(result.lgbm_ci[0])}–${fmtPct(result.lgbm_ci[1])}, ` +
      `decile ${result.lgbm_decile}/9, ${result.lgbm_base_rate_comparison.toFixed(2)}× base)`,
  );
  lines.push(`  EuroSCORE II (ref)   ${fmtPct(result.euroscore_ii.raw_probability)}`);
  lines.push("");

  const c = result.complication_risks;
  lines.push("Procedural complications (30 d, VARC-3):");
  lines.push(`  Stroke               ${fmtPct(c.stroke_30d.p)}  (${c.stroke_30d.multiplier_vs_base.toFixed(1)}× base)`);
  lines.push(`  AKI 2-3              ${fmtPct(c.aki_2_3_30d.p)}  (${c.aki_2_3_30d.multiplier_vs_base.toFixed(1)}× base)`);
  lines.push(`  Major vascular       ${fmtPct(c.major_vascular_30d.p)}  (${c.major_vascular_30d.multiplier_vs_base.toFixed(1)}× base)`);
  lines.push(`  Major bleed          ${fmtPct(c.life_threatening_bleed_30d.p)}  (${c.life_threatening_bleed_30d.multiplier_vs_base.toFixed(1)}× base)`);
  lines.push("");

  const rec = pickRecommendedDevice(result.device_assessments);
  if (rec) {
    lines.push(`Recommended fit: ${rec.valve} ${rec.sizing.recommended_size_mm ?? "?"} mm (lowest combined risk among in-range sizes).`);
    lines.push(`  Coronary obstruction risk: ${rec.coronary_risk.grade}.`);
    if (rec.considerations.length > 0) {
      lines.push("  Considerations:");
      for (const note of rec.considerations) lines.push(`    - ${note}`);
    }
    lines.push("");
  } else {
    lines.push("Recommended fit: none in published sizing range — Heart Team review required.");
    lines.push("");
  }

  const topMod = result.risk_score_drivers.find(
    (d) => d.is_modifiable && d.effect === "increases",
  );
  if (topMod) {
    lines.push(`Top modifiable driver: ${topMod.feature_label}` + (topMod.modify_to ? ` → target ${topMod.modify_to}` : ""));
    lines.push("");
  }

  if (llmNote.trim().length > 0) {
    lines.push("Heart Team note (LLM):");
    for (const ln of llmNote.split("\n")) lines.push(`  ${ln}`);
    lines.push("");
  }

  lines.push("--");
  lines.push("Source: TAVI Risk Insight (auto-generated, not for clinical use). Heart Team makes the call.");
  return lines.join("\n");
}

export function EhrExportActions() {
  const result = usePrediction((s) => s.result);
  const llmNote = usePrediction((s) => s.explanation);
  const [copied, setCopied] = useState(false);
  const [pdfHint, setPdfHint] = useState(false);

  if (!result) return null;

  const handleCopy = async () => {
    const text = buildEhrText(result, llmNote);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open a textarea-prompt
      window.prompt("Copy this Heart Team note:", text);
    }
  };

  const handlePdf = () => {
    setPdfHint(true);
    setTimeout(() => setPdfHint(false), 2500);
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button
        type="button"
        onClick={handleCopy}
        className="ibm-btn-primary text-xs flex items-center gap-1.5"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy to EHR"}
      </button>
      <button
        type="button"
        onClick={handlePdf}
        className="ibm-btn-secondary text-xs flex items-center gap-1.5"
        title="Opens the browser print dialog — save as PDF from there."
      >
        <FileDown className="w-3.5 h-3.5" />
        Export PDF
      </button>
      {pdfHint && (
        <span className="text-[11px] text-gray-500">
          Use the browser's "Save as PDF" option in the print dialog.
        </span>
      )}
      <span className="text-[11px] text-gray-400 ml-auto italic">
        Plain-text Epic / Cerner paste · server-side PDF coming soon
      </span>
    </div>
  );
}
