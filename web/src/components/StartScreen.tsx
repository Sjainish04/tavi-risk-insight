import {
  Activity,
  ArrowRight,
  Calculator,
  Cpu,
  FileText,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";

import { demoPresets } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { type PresetKey, usePrediction } from "@/store/prediction";

const CASE_TONE: Record<PresetKey, { band: string; ring: string; dot: string }> = {
  lowRisk: { band: "Low risk", ring: "hover:ring-emerald-300", dot: "bg-emerald-500" },
  intermediateRisk: { band: "Intermediate risk", ring: "hover:ring-amber-300", dot: "bg-amber-500" },
  highRisk: { band: "High risk", ring: "hover:ring-rose-300", dot: "bg-rose-500" },
};

const STEPS = [
  { icon: Stethoscope, title: "Severity", text: "ACC/AHA 2020 echo criteria" },
  { icon: Calculator, title: "Risk scores", text: "STS-PROM, EuroSCORE II, TVT and an ML model" },
  { icon: Activity, title: "Complications", text: "Stroke, AKI, vascular, bleeding" },
  { icon: Cpu, title: "Device sizing", text: "Per-valve size, PPM and PVL" },
  { icon: FileText, title: "Heart Team note", text: "Plain-language summary for the record" },
];

/** What the workspace shows before any case has been run. */
export function StartScreen() {
  const runPreset = usePrediction((s) => s.runPreset);
  const loading = usePrediction((s) => s.loading);

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-ibm-800 p-6 sm:p-8 text-white shadow-lift">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-ibm-400/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl"
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
            Structural heart team · TAVI
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">
            One case in, a full Heart Team view out.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">
            Severity, three established risk calculators and a machine-learning model,
            procedural complications, and per-device sizing, computed together in a few
            seconds. Start from a demonstration case or fill in the form.
          </p>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">Demonstration cases</p>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(demoPresets) as PresetKey[]).map((key) => {
            const preset = demoPresets[key];
            const tone = CASE_TONE[key];
            return (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => runPreset(key)}
                className={cn(
                  "ibm-card group p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lift hover:ring-2 disabled:opacity-60 disabled:hover:translate-y-0",
                  tone.ring,
                )}
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                  {tone.band}
                </span>
                <span className="mt-2 block text-sm font-semibold text-gray-900">
                  {preset.sublabel.split(" · ").slice(0, 2).join(" · ")}
                </span>
                <span className="mt-1 block text-xs leading-snug text-gray-600">
                  {preset.sublabel.split(" · ").slice(2).join(" · ")}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ibm-600">
                  Run this case
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ibm-card p-4">
        <p className="eyebrow mb-3">What the analysis covers</p>
        <ol className="grid gap-3 sm:grid-cols-5">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative flex gap-3 sm:flex-col sm:gap-2">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ibm-50 text-ibm-600 ring-1 ring-ibm-100">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-xs font-semibold text-gray-900">
                    {index + 1}. {step.title}
                  </span>
                  <span className="block text-[11px] leading-snug text-gray-500">{step.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          Research prototype trained on a synthetic cohort. It supports, and never replaces,
          the multidisciplinary Heart Team&apos;s judgement. The Model Card lists what has and
          has not been validated.
        </p>
      </div>
    </div>
  );
}
