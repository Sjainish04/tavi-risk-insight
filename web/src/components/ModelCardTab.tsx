import { FileText } from "lucide-react";

import { BrdavExternalValidation } from "./BrdavExternalValidation";
import { DCAandFairness } from "./DCAandFairness";
import { ModelComparison } from "./ModelComparison";

const SECTIONS = [
  {
    title: "Model details",
    body: [
      "**Name**: TAVI Risk Insight LightGBM v0.1",
      "**Type**: Gradient-boosted tree (LightGBM 4.6+)",
      "**Cohort**: synthetic 5,000 patients with realistic correlations to PARTNER 3 / Evolut Low Risk era",
      "**Outcome**: 30-day all-cause mortality",
      "**Calibration**: isotonic regression (sklearn FrozenEstimator)",
      "**Explainability**: SHAP TreeExplainer, top-5 features per prediction",
      "**Per-device simulation**: rule-based; combines published baseline rates with patient-specific clinical and CT-derived modifiers",
    ],
  },
  {
    title: "Intended use",
    body: [
      "Decision-support tool for the structural heart team. Augments STS-PROM and EuroSCORE II with era-aware recalibration and per-device complication prediction.",
      "Not a substitute for clinical judgement. Final device and treatment decisions remain with the multidisciplinary Heart Team.",
      "This deployment uses a synthetic cohort; production deployment requires institutional registry data and prospective validation.",
    ],
  },
  {
    title: "Inputs and integration",
    body: [
      "**Clinical**: pulled from EHR via FHIR (Epic Cupid / Cerner Cardiovascular)",
      "**Imaging**: CT-derived measurements from PACS or 3mensio Structural Heart workflow",
      "**Frailty**: bedside-collected (5-meter gait speed, EFT optional)",
      "**Output**: structured risk estimates, per-device simulation, Heart Team narrative — exportable to EHR note",
    ],
  },
  {
    title: "TRIPOD+AI compliance (partial — current scope)",
    body: [
      "✅ Source of data documented (synthetic, deterministic seed=42)",
      "✅ Sample size justified — 5,000 patients, base rate ~3%",
      "✅ Predictors locked at decision time (no peri-procedural leakage)",
      "✅ Performance reported: AUROC, AUPRC, Brier, calibration plot",
      "✅ Internal validation: 5-fold stratified CV + held-out test",
      "❌ External validation — not performed (synthetic only)",
      "❌ Fairness analysis by sex/race/age — partial (sex coded; race not in synthetic schema)",
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
  {
    title: "Recalibration sources",
    body: [
      "Per-decile O/E ratios derived from:",
      "- [Edwards et al. 2019, JTCVS](https://www.jtcvs.org/article/S0022-5223(18)32031-2/fulltext)",
      "- [Vemulapalli et al. 2024, JSCAI](https://www.jscai.org/article/S2772-9303(23)00027-3/fulltext)",
      "- [Structural Heart 2022, n=21,250](https://www.structuralheartjournal.org/article/S2474-8706(22)00839-9/fulltext)",
    ],
  },
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
      "- **Stroke** 1.2% × {prior stroke 2.5, AFib 1.5, eGFR&lt;30 1.4} (Kapadia 2017, Auffret 2017)",
      "- **AKI 2-3** 2.5% × {eGFR&lt;45 2.5, LVEF&lt;35 1.5, DM 1.4, creatinine&gt;2 1.3} (Nuis 2012, Gargiulo 2015)",
      "- **Major vascular** 2.5% × {PVD 3.0, female 1.4, BMI&lt;22 1.3} (van Mieghem 2013, Genereux 2012)",
      "- **Life-threatening bleed** 3.0% × {Hb&lt;11 2.0, AFib 1.7, prior PCI 1.3} (Genereux 2014, Piccolo 2017)",
      "CI is heuristic ±25% of point estimate; replace with bootstrap once a calibration cohort is available.",
    ],
  },
  {
    title: "Per-device sizing (manufacturer IFU)",
    body: [
      "Annular sizing tables — summarised; consult full IFU for clinical use:",
      "- **Edwards SAPIEN 3 Ultra**: by annular area (273–680 mm² → 20/23/26/29 mm). Target 0–15% area oversizing.",
      "- **Medtronic Evolut FX+**: by annular perimeter (56.5–94.3 mm → 23/26/29/34 mm). Target 10–25% perimeter oversizing.",
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
      "Self-expanding supra-annular thresholds shifted +2 mm (leaflets sit higher in sinus).",
    ],
  },
  {
    title: "Special considerations rules",
    body: [
      "Per-device clinical-context flags — referenced in source comments:",
      "- Bicuspid AV: balloon-expandable preferred (Yoon JACC 2017)",
      "- Concomitant ≥ moderate AR: prefer active-sealing (Navitor / Evolut FX+)",
      "- Hostile iliofemoral access: alternative access (Linke JACC CV Interv 2020)",
      "- Reduced LVEF &lt; 30%: Sentinel cerebral embolic protection (Kapadia NEJM 2022 PROTECTED-TAVR)",
      "- Heavy calcium: annular rupture concern with balloon-expandable",
      "- Short MS &lt; 5 mm with self-expanding: elevated PPM (Hamdan JACC 2015)",
    ],
  },
  {
    title: "Risk-score accompaniments",
    body: [
      "Each ML probability is delivered with: **95% CI** (Wilson interval at training-cohort effective n), **decile placement** vs. cohort (`models/reference_deciles.json` or fallback), **base-rate multiplier** vs. cohort 3% target, and **clinical-language drivers** with `is_modifiable` flag and a target value (`modify_to`) — albumin, hemoglobin, gait speed, NYHA. Drivers are the SHAP top-5 mapped to readable labels with approximate per-feature impact in percentage points.",
    ],
  },
  {
    title: "Stack",
    body: [
      "**LLM (LIVE)**: IBM Granite-4 H-Small on watsonx.ai (us-south) — project 690787bb-...c334a5",
      "**Safety filter (LIVE)**: IBM Granite Guardian 3-8B classifies every Granite response before tokens reach the client; unsafe outputs are suppressed and replaced with a Heart-Team-review fallback",
      "**Fallback chain**: BioMistral-7B-DARE via Featherless AI → mock generator (offline)",
      "**Backend**: FastAPI on IBM Cloud Code Engine",
      "**Frontend**: Vite + React on Vercel",
      "**Container Registry**: IBM Container Registry",
      "**Encryption**: AES-256 Fernet; production target IBM HPCS on IBM Z LinuxONE (FIPS 140-2 Level 4)",
    ],
  },
];

export function ModelCardTab() {
  return (
    <div className="ibm-card p-4 space-y-3 max-w-4xl">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <FileText className="w-4 h-4 text-ibm-500" />
        Model Card · TRIPOD+AI · PROBAST
      </h3>
      <div className="space-y-3 text-sm text-gray-800">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h4 className="font-semibold text-gray-900 mb-1">{s.title}</h4>
            <ul className="list-none space-y-0.5 pl-0">
              {s.body.map((line, i) => (
                <li
                  key={i}
                  className="text-xs leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: line.replace(
                      /\*\*([^*]+)\*\*/g,
                      "<strong>$1</strong>",
                    ),
                  }}
                />
              ))}
            </ul>
          </section>
        ))}
        <ModelComparison />
        <DCAandFairness />
        <BrdavExternalValidation />
      </div>
    </div>
  );
}
