# TAVI Clinical Outputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the clinical outputs the Heart Team actually needs (severity, futility, procedural complications, per-device sizing, coronary risk, special considerations) and the risk-score accompaniments (CI, decile, modifiable drivers). Rule-based modules grounded in published baselines; no new ML training.

**Architecture:** Extend Pydantic schema with severity inputs (AVA, gradient, peak velocity) and clinical anatomy (BAV flag, sinus of Valsalva, AR grade, frailty scale). Add focused scoring modules (`severity.py`, `futility.py`, `complications.py`) and a new `sizing/` package (annular, coronary obstruction, considerations). Enrich `RiskOutput`. On the frontend, extend the form, add new output cards, upgrade the risk panel.

**Tech stack:** Existing — FastAPI + Pydantic v2 + LightGBM + SHAP (backend); Vite + React + zustand + zod + Plotly (frontend). No new dependencies.

---

## Scope

**In scope (per user-approved selections):**
- Phase 1: severity confirmation + futility flag (alternative = medical therapy)
- Phase 2: 30-day mortality (existing) + stroke / AKI / vascular / bleed
- Phase 3: annular sizing (required), coronary obstruction (good to have), special considerations (needed)
- Risk score: CI, decile, drivers in clinical language, base-rate comparison, modifiable flag
- Heart Team note: minor prompt enhancement

**Out of scope (explicitly):**
- Citations in UI (deferred to future)
- 1-year mortality model
- SAVR vs TAVI comparison
- Length-of-stay / disposition
- Access-route assessment
- Retraining LightGBM with new features
- Prior-critique fixes (calibration leakage, FEops branding, AES-256 label)

---

## File Structure

**NEW backend files:**
- `api/src/tavi_api/scoring/severity.py`
- `api/src/tavi_api/scoring/futility.py`
- `api/src/tavi_api/scoring/complications.py`
- `api/src/tavi_api/scoring/decile.py`
- `api/src/tavi_api/scoring/drivers.py`
- `api/src/tavi_api/sizing/__init__.py`
- `api/src/tavi_api/sizing/annular.py`
- `api/src/tavi_api/sizing/coronary.py`
- `api/src/tavi_api/sizing/considerations.py`
- `api/tests/__init__.py`
- `api/tests/test_severity.py`, `test_futility.py`, `test_complications.py`, `test_annular_sizing.py`, `test_coronary.py`, `test_considerations.py`, `test_decile.py`, `test_drivers.py`

**MODIFIED backend files:**
- `api/src/tavi_api/schemas.py`
- `api/src/tavi_api/routes/predict.py`
- `api/src/tavi_api/scoring/__init__.py`
- `api/src/tavi_api/llm/prompts.py`

**NEW frontend files:**
- `web/src/components/SeverityCard.tsx`
- `web/src/components/FutilityBanner.tsx`
- `web/src/components/ComplicationsTable.tsx`
- `web/src/components/AnnularSizingTable.tsx`
- `web/src/components/CoronaryRiskCard.tsx`
- `web/src/components/SpecialConsiderationsCard.tsx`

**MODIFIED frontend files:**
- `web/src/lib/types.ts`
- `web/src/lib/schema.ts`
- `web/src/components/PatientForm.tsx`
- `web/src/components/RiskComparison.tsx`
- `web/src/components/ShapWaterfall.tsx`
- `web/src/App.tsx`
- `web/src/components/ModelCardTab.tsx`

**DELETED:**
- `web/src/components/ProceduralSimulation.tsx`

---

## Tasks (16 total — see chat for executed code)

The chat-side execution covers all 16 tasks in batches:

1. Schema extension (PatientInput + RiskOutput + new output types)
2. severity.py + tests (ACC/AHA 2020 criteria)
3. futility.py + tests (composite frailty + comorbidity)
4. complications.py + tests (VARC-3 baselines + multipliers)
5. annular.py + tests (per-device sizing tables)
6. coronary.py + tests (obstruction risk grade)
7. considerations.py + tests (BAV / AR / PVD flags)
8. decile.py + drivers.py + tests
9. predict route composes new modules
10. LLM prompt extension
11. Frontend types + zod + presets
12. PatientForm extension
13. SeverityCard + FutilityBanner + ComplicationsTable
14. AnnularSizingTable + CoronaryRiskCard + SpecialConsiderationsCard (replaces ProceduralSimulation)
15. RiskComparison + ShapWaterfall upgrade
16. Model Card update + smoke test

---

## Notes for the executor

- This project is **not a git repo** — skip `git commit` steps.
- `tests/` directory does not exist yet — create it with `__init__.py`.
- `api/.env.example` is in a denied path — do not attempt to read it.
- LightGBM is **not retrained**; new fields used only for new modules.
- All new probability outputs include `lo`, `hi`, `base_rate`, `multiplier_vs_base`. CI heuristic: ±25% of point estimate; document.
- Baseline rates are from VARC-3 contemporary literature — cite in source comments.
- Sizing tables are simplified manufacturer IFU summaries — note "consult full IFU for clinical use."
- All severity / futility / complication / sizing / coronary / considerations modules are **pure functions** — no I/O, no global state, fast tests.
