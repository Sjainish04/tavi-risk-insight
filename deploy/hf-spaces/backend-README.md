---
title: TAVI Backend
emoji: 🫀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
license: mit
short_description: TAVI risk-prediction API · Granite-4 on watsonx.ai
---

# TAVI Risk Insight — Backend API

FastAPI service for the TAVI Risk Insight project.
Source: [github.com/Sjainish04/tavi-risk-insight](https://github.com/Sjainish04/tavi-risk-insight)

## Endpoints

| Path | Method | What it does |
|---|---|---|
| `/healthz` | GET | provider + region + loaded models |
| `/predict` | POST | full 5-model risk panel (STS-PROM raw/recal, EuroSCORE II, ACC TVT, v3 stacking, brdav 5th opinion) + severity, futility, complications, per-device sizing |
| `/explain` | POST | SSE stream of Granite-4 Heart-Team narrative, Granite-Guardian-filtered |

## Architecture

This Space runs the FastAPI backend. It calls a sibling brdav-inference Space
for the real-cohort 5th-opinion oracle (Brüggemann 2024, n=1,449 real Zürich
TAVR patients) and IBM watsonx.ai for the Granite-4 narrative.

## Configuration

All secrets injected via Space Settings → Variables and secrets:
- `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_REGION`, `WATSONX_BASE_URL`
- `GRANITE_MODEL_ID`, `GRANITE_GUARDIAN_MODEL_ID`
- `LLM_PROVIDER=watsonx`
- `BRDAV_URL` — URL of the sibling brdav Space + `/infer`
- `CORS_ORIGINS` — frontend Vercel URL(s)
- `FEATHERLESS_API_KEY` (fallback)

## Built for

IBM Z × UNSA Sheridan Hackathon, 2026.
