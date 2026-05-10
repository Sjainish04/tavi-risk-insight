import { ArrowRight, FileText } from "lucide-react";
import { useState } from "react";

import { BrdavExternalValidation } from "./BrdavExternalValidation";
import { CalibrationPlot } from "./CalibrationPlot";
import { DCAandFairness } from "./DCAandFairness";
import { DecisionCurvePlot } from "./DecisionCurvePlot";
import { ModelCardNav, type ModelCardView } from "./ModelCardNav";
import { ModelComparison } from "./ModelComparison";
import { ShapWaterfall } from "./ShapWaterfall";
import { usePrediction } from "@/store/prediction";

interface SectionBlock {
  title: string;
  body: string[];
  see_also?: ModelCardView;
}

const OVERVIEW_SECTIONS: SectionBlock[] = [
  {
    title: "Model details",
    body: [
      "**Name**: TAVI Risk Insight LightGBM v0.1",
      "**Type**: Gradient-boosted tree (LightGBM 4.6+)",
      "**Cohort**: synthetic 5,000 patients with realistic correlations to PARTNER 3 / Evolut Low Risk era",
      "**Outcome**: 30-day all-cause mortality",
      "**Calibration**: isotonic regression (sklearn FrozenEstimator)",
      "**Explainability**: SHAP TreeExplainer, top-5 features per prediction",
    ],
  },
  {
    title: "Intended use",
    body: [
      "Decision-support tool for the structural Heart Team. Augments STS-PROM and EuroSCORE II with era-aware adjustment and per-device complication estimates.",
      "Not a substitute for clinical judgement. Final device and treatment decisions remain with the multidisciplinary Heart Team.",
      "This deployment uses a synthetic cohort. Production deployment requires institutional registry data and prospective validation.",
    ],
  },
  {
    title: "Inputs and integration",
    body: [
      "**Clinical**: pulled from the EHR via FHIR (Epic Cupid / Cerner Cardiovascular)",
      "**Imaging**: CT-derived measurements from PACS or 3mensio Structural Heart workflow",
      "**Frailty**: bedside-collected (5-meter gait speed, Clinical Frailty Scale)",
      "**Output**: structured risk estimates, per-device assessment, Heart Team note — exportable to EHR.",
    ],
  },
  {
    title: "Stack",
    body: [
      "**LLM (live)**: IBM Granite-4 H-Small on watsonx.ai (us-south)",
      "**Safety filter (live)**: IBM Granite Guardian 3-8B classifies every Granite response before tokens reach the client",
      "**Fallback chain**: BioMistral-7B-DARE via Featherless AI → mock generator (offline)",
      "**Backend**: FastAPI on IBM Cloud Code Engine",
      "**Frontend**: Vite + React on Vercel",
      "**Container Registry**: IBM Container Registry",
      "**Encryption**: AES-128 Fernet at rest; production target IBM Cloud Key Protect (envelope encryption)",
    ],
  },
];

const METHODS_SECTIONS: SectionBlock[] = [
  {
    title: "AS severity confirmation",
    body: [
      "Per ACC/AHA 2020 Valve Guideline (Otto CM et al. JACC 77:e25):",
      "- **Severe** if any of: AVA &lt; 1.0 cm², mean gradient ≥ 40 mmHg, peak velocity ≥ 4.0 m/s",
      "- **Very severe** if mean gradient ≥ 60 mmHg or peak velocity ≥ 5.0 m/s",
      "- **Low-flow / low-gradient** classical: LVEF &lt; 50% with low gradient and small AVA",
    ],
  },
  {
    title: "Futility composite",
    body: [
      "Transparent linear composite (threshold 0.50) over: severe frailty (CFS ≥ 7, +0.30), age &gt; 90 (+0.20), albumin &lt; 3.0 g/dL (+0.20), dialysis (+0.15), severe gait-speed (&lt;0.5 m/s, +0.15), multimorbidity ≥ 3 (+0.10), NYHA IV (+0.05), LVEF &lt; 25% (+0.05).",
      "When raised, the **alternative is medical therapy** (diuretics, neurohormonal blockade, palliative referral) — SAVR is not appropriate when TAVI is futile.",
      "Evidence: ACC/AHA 2020; Afilalo JACC 2017; Shimura JACC Cardiovasc Interv 2017.",
    ],
  },
  {
    title: "Procedural complication risks (VARC-3)",
    body: [
      "30-day baselines from PARTNER 3 / Evolut Low Risk era + multiplicative modifiers:",
      "- **Stroke** 1.2 % × {prior stroke 2.5, AFib 1.5, eGFR&lt;30 1.4} (Kapadia 2017, Auffret 2017)",
      "- **AKI 2-3** 2.5 % × {eGFR&lt;45 2.5, LVEF&lt;35 1.5, DM 1.4, creatinine&gt;2 1.3} (Nuis 2012, Gargiulo 2015)",
      "- **Major vascular** 2.5 % × {PVD 3.0, female 1.4, BMI&lt;22 1.3} (van Mieghem 2013, Genereux 2012)",
      "- **Major bleed** 3.0 % × {Hb&lt;11 2.0, AFib 1.7, prior PCI 1.3} (Genereux 2014, Piccolo 2017)",
      "CI is heuristic ±25 % of point estimate; replace with bootstrap once a calibration cohort is available.",
    ],
  },
  {
    title: "Per-device sizing (manufacturer IFU)",
    body: [
      "Annular sizing tables — summarised; consult full IFU for clinical use:",
      "- **Edwards SAPIEN 3 Ultra**: by annular area (273–680 mm² → 20/23/26/29 mm). Target 0–15 % area oversizing.",
      "- **Medtronic Evolut FX+**: by annular perimeter (56.5–94.3 mm → 23/26/29/34 mm). Target 10–25 % perimeter oversizing.",
      "- **Abbott Navitor**: by annular area (283–572 mm² → 23/25/27/29 mm). NaviSeal active sealing.",
      "Baseline 30-d PPM / mod+ PVL: PARTNER 3 (Mack 2019), SURTAVI / Evolut Low Risk (Reardon 2017, Popma 2019), PORTICO NG (Linke 2023).",
    ],
  },
  {
    title: "Coronary obstruction risk",
    body: [
      "Graded low / intermediate / high from coronary heights and sinus of Valsalva diameter (Ribeiro JACC 2013, Yamamoto Circ CV Interv 2014):",
      "- **High** if LM &lt; 10 mm OR RCA &lt; 11 mm OR sinus &lt; 28 mm",
      "- **Intermediate** if any borderline (LM 10–12, RCA 11–12, sinus 28–30)",
      "- **Low** otherwise",
      "Self-expanding supra-annular thresholds are shifted +2 mm (leaflets sit higher in the sinus).",
    ],
  },
  {
    title: "Special considerations rules",
    body: [
      "Per-device clinical-context flags — referenced in source comments:",
      "- Bicuspid AV: balloon-expandable preferred (Yoon JACC 2017)",
      "- Concomitant ≥ moderate AR: prefer active-sealing (Navitor / Evolut FX+)",
      "- Hostile iliofemoral access: alternative access (Linke JACC CV Interv 2020)",
      "- Reduced LVEF &lt; 30 %: Sentinel cerebral embolic protection (Kapadia NEJM 2022 PROTECTED-TAVR)",
      "- Heavy calcium: annular rupture concern with balloon-expandable",
      "- Short MS &lt; 5 mm with self-expanding: elevated PPM (Hamdan JACC 2015)",
    ],
  },
  {
    title: "Era-aware STS-PROM adjustment",
    body: [
      "Per-decile O/E ratios derived from contemporary TAVI registries:",
      "- [Edwards et al. 2019, JTCVS](https://www.jtcvs.org/article/S0022-5223(18)32031-2/fulltext)",
      "- [Vemulapalli et al. 2024, JSCAI](https://www.jscai.org/article/S2772-9303(23)00027-3/fulltext)",
      "- [Structural Heart 2022, n=21,250](https://www.structuralheartjournal.org/article/S2474-8706(22)00839-9/fulltext)",
    ],
  },
  {
    title: "Risk-score accompaniments",
    body: [
      "Each ML probability is delivered with: **95% CI** (Wilson interval at training-cohort effective n), **decile placement** vs. cohort, **base-rate multiplier** vs. cohort 3 % target, and **clinical-language drivers** with `is_modifiable` flag and a target value (`modify_to`) — albumin, hemoglobin, gait speed, NYHA. Drivers are the SHAP top-5 mapped to readable labels with approximate per-feature impact in percentage points.",
    ],
    see_also: "this-case",
  },
];

const VALIDATION_TEXT_SECTIONS: SectionBlock[] = [
  {
    title: "TRIPOD+AI compliance (current scope)",
    body: [
      "✅ Source of data documented (synthetic, deterministic seed=42)",
      "✅ Sample size justified — 5,000 patients, base rate ~3 %",
      "✅ Predictors locked at decision time (no peri-procedural leakage)",
      "✅ Performance reported: AUROC, AUPRC, Brier, calibration plot",
      "✅ Internal validation: 5-fold stratified CV + held-out test",
      "❌ External validation — not performed (synthetic only)",
      "❌ Fairness analysis by sex / race / age — partial (sex coded; race not in synthetic schema)",
      "❌ Prospective clinical-impact study — out of scope for v0.1",
    ],
  },
  {
    title: "PROBAST risk-of-bias self-assessment",
    body: [
      "**Participants** — high (synthetic cohort, not real patients)",
      "**Predictors** — low (locked pre-procedure, no leakage)",
      "**Outcome** — low (well-defined, complete labels in synthetic data)",
      "**Analysis** — moderate (single calibration fold, no external test)",
      "**Overall**: HIGH risk of bias by PROBAST. Honest disclosure: this version is an architectural prototype, not a clinically validated model.",
    ],
  },
];

function renderSection(s: SectionBlock, onSeeAlso?: (v: ModelCardView) => void) {
  return (
    <section key={s.title} className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900">{s.title}</h4>
      <ul className="list-none space-y-1 pl-0">
        {s.body.map((line, i) => (
          <li
            key={i}
            className="text-sm leading-relaxed text-gray-700"
            dangerouslySetInnerHTML={{
              __html: line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        ))}
      </ul>
      {s.see_also && onSeeAlso && (
        <button
          type="button"
          onClick={() => onSeeAlso(s.see_also!)}
          className="inline-flex items-center gap-1 text-xs text-ibm-700 hover:text-ibm-800 hover:underline"
        >
          See on this case <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </section>
  );
}

function CrossLink({
  to,
  label,
  onChange,
}: {
  to: ModelCardView;
  label: string;
  onChange: (v: ModelCardView) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(to)}
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-ibm-50 text-ibm-700 hover:bg-ibm-100 border border-ibm-200 rounded-sm transition-colors"
    >
      {label}
      <ArrowRight className="w-3 h-3" />
    </button>
  );
}

export function ModelCardTab() {
  const [view, setView] = useState<ModelCardView>("overview");
  const result = usePrediction((s) => s.result);

  return (
    <div className="ibm-card p-5 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-ibm-500" />
            Model Card · TRIPOD+AI · PROBAST
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Research and audit surface. The plain-English clinical view is on the Heart Team Workspace tab.
          </p>
        </div>
      </div>

      <ModelCardNav active={view} onChange={setView} />

      {view === "overview" && (
        <div className="space-y-6 pt-2">
          {OVERVIEW_SECTIONS.map((s) => renderSection(s, setView))}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
              Read more
            </p>
            <div className="flex flex-wrap gap-1.5">
              <CrossLink to="methods" label="How each module works" onChange={setView} />
              <CrossLink to="this-case" label="Plots for the current case" onChange={setView} />
              <CrossLink to="validation" label="Validation + risk of bias" onChange={setView} />
            </div>
          </div>
        </div>
      )}

      {view === "methods" && (
        <div className="space-y-6 pt-2">
          {METHODS_SECTIONS.map((s) => renderSection(s, setView))}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
              Verify on a case
            </p>
            <div className="flex flex-wrap gap-1.5">
              <CrossLink to="this-case" label="See SHAP + calibration on the current patient" onChange={setView} />
              <CrossLink to="validation" label="See model variants + benchmarks" onChange={setView} />
            </div>
          </div>
        </div>
      )}

      {view === "this-case" && (
        <div className="space-y-4 pt-2">
          {result ? (
            <>
              <p className="text-xs text-gray-500 italic">
                Driven by the most recent /predict result. Submit a new case from the Heart Team Workspace tab to refresh.
              </p>
              <ShapWaterfall />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CalibrationPlot />
                <DecisionCurvePlot />
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
                  Read the methods behind these plots
                </p>
                <CrossLink to="methods" label="Risk-score accompaniments + recalibration" onChange={setView} />
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-sm text-gray-500">
              Submit a case on the Heart Team Workspace tab to populate the per-case plots.
            </div>
          )}
        </div>
      )}

      {view === "validation" && (
        <div className="space-y-6 pt-2">
          {VALIDATION_TEXT_SECTIONS.map((s) => renderSection(s, setView))}
          <BrdavExternalValidation />
          <ModelComparison />
          <DCAandFairness />
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
              Cross-references
            </p>
            <div className="flex flex-wrap gap-1.5">
              <CrossLink to="methods" label="See how each module produces its output" onChange={setView} />
              <CrossLink to="overview" label="Stack + intended use" onChange={setView} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
