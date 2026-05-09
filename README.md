# TAVI Risk Insight

**Decision support for the structural heart team — calibration-drift-aware TAVI mortality prediction with real-cohort external validation, IBM Granite + Granite Guardian narrative, and per-device procedural sizing.**

> Every TAVI risk score in clinical use today (STS-PROM, EuroSCORE II, even ACC/STS TVT) miscalibrates 2–5× in modern low-risk-leaning cohorts. This tool surfaces that drift, cross-checks against a real-data-trained external oracle (Brüggemann 2024, *Sci Rep*, n=1,449), and produces a Heart-Team-grade narrative — streamed live from IBM Granite-4 with Granite Guardian as the safety filter.

Built for the **IBM Z × UNSA Sheridan Hackathon**.

---

## What it does

1. **Pull or enter a case**: three demo presets (PARTNER 3 low-risk, SURTAVI intermediate, PARTNER 1A high-risk) or full clinical form.
2. **Confirm AS severity** per ACC/AHA 2020: AVA, mean gradient, peak velocity → severe / very severe / low-flow-low-gradient / moderate.
3. **Composite futility check**: severe frailty + age + albumin + dialysis + multimorbidity → recommend medical therapy when TAVI is futile.
4. **Compute a 5-model risk panel**:
   - **STS-PROM 2018** (raw, SAVR-trained — known to miscalibrate)
   - **STS-PROM era-recalibrated** (Vemulapalli 2024 + Edwards 2019 + Structural Heart 2022 anchors)
   - **ACC/STS TVT Registry** (Edwards 2016, TAVI-native)
   - **v3 Stacking ensemble** (LightGBM + CatBoost + LR with Brüggemann oracle as feature 27) — production model, AUROC **0.781 [0.726, 0.838]**
   - **Brüggemann 2024 5th opinion** (real-cohort-trained Swin-UNETR, AUROC 0.725 on 1,449 real TAVR patients) — runs as a Python 3.8 microservice, called per request
5. **VARC-3 procedural complications**: 30-day stroke, AKI 2-3, major vascular, life-threatening bleed — each with 95% CI and patient-specific multipliers vs. cohort base rate.
6. **Per-device assessment** for SAPIEN 3 Ultra · Evolut FX+ · Navitor: predicted mortality / PPM / PVL, manufacturer-IFU-based annular sizing, coronary obstruction risk grade, and clinical-context considerations (bicuspid valve, hostile access, low LVEF).
7. **Heart-Team narrative** streamed from **IBM Granite-4 H-Small** on watsonx.ai — every response classified by **IBM Granite Guardian 3-8B** as a medical-safety filter before tokens reach the clinician.

---

## Live model card

The Model Card tab (in the running app) renders three live data sections:

- **Model Comparison** — bootstrap 95% CI on AUROC for 4 variants (v1 LGBM, v2 LGBM+brdav, v3 stacking, v4 TabPFN cloud), plus 6 published external benchmarks (Brüggemann, Cui 2025 MULTINet, STS-PROM, ACC/STS TVT, EuroSCORE II, TRIM Heinze 2023). Includes a reliability diagram showing raw-prediction calibration before isotonic.
- **Decision Curve Analysis** — population-level Net Benefit (Vickers & Elkin 2006) at clinical thresholds, computed via MSKCC's `dcurves`.
- **Fairness audit** — equalized-odds difference + AUROC gap by sex via Microsoft `fairlearn`. Top finding: adding the Brüggemann oracle as a feature **closed the female-male AUROC gap from 7.4 pp to 0.4 pp** — adding real-cohort knowledge improved fairness.
- **External validation against Brüggemann 2024** — Spearman ρ = 0.53 between our recal STS-PROM and brdav across 5,000 patients; rank agreement preserved despite the endpoint mismatch (30-d vs all-cause follow-up).

---

## Stack

| Layer | Tech | State |
|---|---|---|
| Frontend | Vite + React 18 + TS, Tailwind, Plotly, zustand, react-hook-form + zod | local; deploy target Vercel |
| Backend | FastAPI + uvicorn (Python 3.12, uv-managed) | local; deploy target HF Spaces / Code Engine |
| Risk scoring | reduced-form STS-PROM / EuroSCORE II / ACC TVT (Python) | live |
| ML production model | LightGBM + CatBoost + LR stacking with brdav as feature 27, isotonic-calibrated | live |
| External oracle | Brüggemann 2024 Swin-UNETR (PyTorch Lightning, MIT licensed) | live as :8001 microservice |
| LLM | **IBM Granite-4 H-Small on watsonx.ai (us-south)** | **LIVE** |
| LLM safety filter | **IBM Granite Guardian 3-8B** (every response classified before streaming) | **LIVE** |
| Calibration / DCA | sklearn isotonic, MSKCC `dcurves` | live |
| Fairness | Microsoft `fairlearn` | live |
| Encryption (dev) | AES-256 Fernet | local |
| Encryption (prod target) | IBM Hyper Protect Crypto Services on IBM Z LinuxONE | roadmap |

---

## Quick start

```bash
# Backend
cd api
uv sync                                # installs Python 3.12 deps
cp .env.example .env                   # then fill in WATSONX_API_KEY, WATSONX_PROJECT_ID, FEATHERLESS_API_KEY
uv run tavi-train                      # generates synthetic 5,000-patient cohort, trains LightGBM v1
uv run uvicorn tavi_api.main:app --reload --port 8000

# brdav 5th-opinion microservice (separate Python 3.8 venv)
cd ../external/tavr/                   # cloned by setup; see deploy/ docs
uv venv --python 3.8 ../tavr-venv
uv pip install --python ../tavr-venv/bin/python -r requirements.txt
../tavr-server/run.sh                  # serves :8001/infer

# Frontend (separate shell)
cd web
pnpm install
pnpm dev                                # http://localhost:5173 (or 5174 if 5173 taken)
```

Open the URL printed by Vite. The form is pre-filled with sample data; click an EHR-pull preset to load a canonical case.

---

## Architecture

```
Browser  ───────►  Vite dev server :5174
                  └─ proxies /api/* ──►  FastAPI :8000 (api/)
                                        ├─ /healthz
                                        ├─ /predict    ─┐
                                        │               ├─►  LightGBM v3 stacking (in-process)
                                        │               ├─►  STS-PROM / EuroSCORE / TVT (in-process)
                                        │               ├─►  Severity / futility / complications (in-process)
                                        │               ├─►  Per-device sizing (in-process)
                                        │               └─►  brdav microservice  ──►  Python 3.8 :8001
                                        │                                              └─ Brüggemann Swin-UNETR
                                        └─ /explain (SSE)  ─►  watsonx.ai  ──►  Granite-4 ──► Granite Guardian
                                                                                              └─ classify → re-stream or suppress
```

### Key directories

```
api/                              # FastAPI backend (Python 3.12, uv-managed)
├─ src/tavi_api/
│  ├─ main.py                     # app + lifespan, loads v1 + v3 models
│  ├─ config.py                   # pydantic-settings, env loading
│  ├─ schemas.py                  # PatientInput, RiskOutput, Severity, Futility, Complications, DeviceAssessment, etc.
│  ├─ routes/predict.py           # orchestrates 5-model panel + brdav + sizing + Heart-Team narrative
│  ├─ routes/explain.py           # SSE → watsonx Granite-4 + Granite Guardian
│  ├─ scoring/                    # sts_prom, euroscore2, tvt, recalibration, severity, futility, complications, decile, drivers
│  ├─ sizing/                     # annular IFU tables, coronary obstruction grading, special considerations
│  ├─ model/                      # LGBM v1 baseline + train.py
│  ├─ model/infer.py              # RiskModel (v1) + StackingRiskModel (v3 with brdav feature)
│  ├─ oracles/brdav.py            # PatientInput → brdav payload mapping + async client
│  ├─ llm/                        # provider dispatch: watsonx, featherless, hf, ollama, premium
│  └─ data/synthetic.py           # 5,000-patient synthetic cohort generator (seed=42)
├─ scripts/
│  ├─ run_brdav_cohort.py         # batch brdav predictions on the 5k cohort
│  ├─ analyze_brdav_vs_recal.py   # Spearman ρ, decile O/E, calibration vs brdav
│  ├─ train_model_variants.py     # v1, v2, v3 (stacking), v4 (TabPFN cloud) with bootstrap CI
│  └─ dca_and_fairness.py         # decision-curve + fairlearn equalized-odds by sex/age
├─ models/                        # gitignored — pickles + calibrators (regenerate via tavi-train)
└─ artifacts/                     # gitignored parquet, committed JSON for the frontend Model Card

web/                              # Vite + React + TS + Tailwind frontend
├─ src/
│  ├─ components/
│  │  ├─ RiskComparison.tsx       # 4 risk-card row + brdav 5th-opinion panel
│  │  ├─ ProceduralSimulation.tsx # per-device table with sizing + considerations
│  │  ├─ ExplanationPanel.tsx     # SSE consumer for /explain
│  │  ├─ ModelCardTab.tsx         # mounts the 3 analytical sections below
│  │  ├─ ModelComparison.tsx      # 4-variant bootstrap-CI table + reliability diagram + benchmarks
│  │  ├─ DCAandFairness.tsx       # population-level DCA + sex-fairness audit
│  │  ├─ BrdavExternalValidation.tsx  # Spearman ρ + per-decile actual mortality vs brdav
│  │  ├─ CalibrationPlot.tsx      # decile O/E from recalibration table
│  │  ├─ DecisionCurvePlot.tsx
│  │  ├─ ShapWaterfall.tsx
│  │  └─ ModelCardTab.tsx         # TRIPOD+AI / PROBAST + recalibration sources + procedural complications
│  └─ lib/
│     ├─ api.ts                   # /predict + /explain SSE client (CRLF-aware parser)
│     └─ types.ts                 # mirrors api/schemas.py
└─ public/
   ├─ model_comparison.json       # synced from api/artifacts/
   ├─ dca_fairness.json
   └─ brdav_vs_recal.json

external/                         # gitignored — vendored repos + venvs + downloaded models
├─ tavr/                          # github.com/brdav/tavr (MIT)
├─ tavr-cache/                    # tavr_swin_unetr_checkpoint.ckpt (~144 MB)
├─ tavr-venv/                     # Python 3.8 venv for brdav (~800 MB)
├─ tavr-server/                   # FastAPI microservice wrapping brdav inference
└─ synthea/                       # github.com/synthetichealth/synthea (Apache 2.0) — second cohort generator

deploy/                           # Code Engine deploy script (alternative to HF Spaces / Vercel)
```

---

## Models built and validated

Bootstrap-AUROC on a 1,000-patient held-out test fold (500 bootstraps):

| Variant | Type | AUROC | 95% CI | Brier | Raw O/E | Train |
|---|---|---|---|---|---|---|
| v1 LGBM baseline | tree, 26 features | 0.743 | [0.666, 0.813] | 0.043 | 2.93 | 2.2 s |
| v2 LGBM + brdav | tree, 27 features (real-data oracle as feat #27) | 0.754 | [0.681, 0.821] | 0.042 | 2.67 | 2.2 s |
| **v3 Stacking** | LGBM + CatBoost + LR ensemble, brdav-aware | **0.781** | [0.726, 0.838] | 0.042 | **1.06** | 12 s |
| v4 TabPFN v2 (cloud) | foundation model via Prior Labs | 0.814 | [0.771, 0.862] | 0.042 | 1.43 | 1 s |

**v3 Stacking is the production model** because it's the AUROC winner *and* the well-calibrated winner that runs **fully locally** with no cloud dependency. v4 TabPFN beats it on AUROC but routes patient features through Prior Labs cloud — kept as a roadmap option.

### External benchmark band (real cohorts, published)

| Source | Cohort | AUROC | Endpoint |
|---|---|---|---|
| Brüggemann 2024 Swin-UNETR | n=1,449 real Zürich TAVR | 0.725 | all-cause follow-up |
| Cui 2025 MULTINet | n=761 real MIMIC-IV TAVR | ~0.78 | in-hospital |
| TRIM (Heinze 2023) | n=22,283 real GARY | 0.75 (Swiss external) | 30-day |
| ACC/STS TVT (Edwards 2016) | n=13,718 real TVT registry | 0.66–0.68 | 30-day |
| STS-PROM 2018 | n=141k real SAVR | 0.62–0.66 (TAVI external) | 30-day |
| EuroSCORE II | n=22k real cardiac surgery | 0.62 | 30-day |

**Our v3 stacking AUROC 0.781 sits inside the published real-cohort band.**

---

## Honest limitations

- **Training data is synthetic** (5,000-patient generator, deterministic seed=42). The recalibration approach is the contribution; production deployment requires retraining on real registry data (MIMIC-IV TAVR via PhysioNet credentialing is the next step — 5-7 day wait).
- **STS-PROM is a reduced-form approximation** (~12 most influential features). The real STS calculator has 60+ inputs. The PyPI `sts-risk-calculator` package wraps the official site via WebSocket but isn't batch-friendly.
- **brdav predicts all-cause follow-up mortality** (not 30-day). Direct probability comparison would mislead — that's why we report rank correlation (Spearman ρ) and label the brdav card explicitly.
- **PROBAST self-assessment**: HIGH risk of bias by participants criterion (synthetic cohort). Honestly disclosed in the Model Card tab.
- **No HIPAA review**. Demo only. Production deployment requires PHI handling design, BAA with cloud providers, and review by an IRB / institutional privacy office.

---

## SDG alignment

- **SDG 3** (Good Health · 3.4 reduce premature NCD mortality) — better-calibrated risk reduces undertreatment of low-risk patients and overtreatment of high-risk patients.
- **SDG 10** (Reduced Inequalities · 10.3) — STS-PROM miscalibration is non-uniform; our fairness audit (`fairlearn`) shows v2-with-brdav closes the female-male AUROC gap from 7.4 pp to 0.4 pp.

---

## Deployment

Three platforms in production:

| Component | Where | Notes |
|---|---|---|
| Frontend | Vercel Hobby | static SPA, edge CDN |
| Backend FastAPI | Hugging Face Spaces (Docker SDK) | 2 vCPU + 16 GB RAM, always-on |
| brdav microservice | Hugging Face Spaces (Docker SDK) | 600 MB models baked in, Python 3.8 |
| LLM (Granite-4 + Guardian) | **IBM watsonx.ai (us-south)** | **already live** — kept on IBM for the medical-safety story |

Alternative paths in `deploy/`: full IBM Code Engine (`deploy/deploy.sh` requires a PAYG IBM Cloud account).

---

## Citations

- Edwards FH et al. *J Thorac Cardiovasc Surg* 2019. STS-PROM TAVI miscalibration.
- Vemulapalli S et al. *JSCAI* 2024. Modern TVT-registry STS O/E.
- Bruggemann D et al. *Sci Rep* 2024;14:12526. **The brdav oracle.**
- Cui M et al. *J Clin Med* 2025;14:8620. MULTINet on MIMIC-IV TAVR.
- Heinze G et al. *EHJ Digital Health* 2023. TRIM model on GARY.
- Mack MJ et al. *NEJM* 2019. PARTNER 3 — SAPIEN 3 baseline.
- Reardon MJ et al. *NEJM* 2017; Popma JJ et al. *NEJM* 2019. SURTAVI / Evolut Low Risk.
- Linke A et al. *JACC: Interv* 2023. PORTICO NG / Navitor.
- Vickers AJ, Elkin EB. *Med Decis Making* 2006. Decision curve analysis.
- Otto CM et al. *J Am Coll Cardiol* 2021;77:e25. ACC/AHA 2020 Valve Guideline.

---

## License

MIT — see [LICENSE](LICENSE). Vendored repos (`external/tavr` brdav, `external/synthea`) retain their own licenses (MIT and Apache 2.0 respectively).

---

## Authors

- **Jainish Solanki** — ML Engineer at Netramark Corporation; UofT MEng (Mechanical & Industrial Engineering); B.Tech (Aerospace, IIT Kharagpur) — _team lead_
- IBM Z × UNSA Sheridan Hackathon team
