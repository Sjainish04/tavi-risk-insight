---
title: TAVI brdav Oracle
emoji: 🧠
colorFrom: red
colorTo: pink
sdk: docker
app_port: 8001
pinned: false
license: mit
short_description: Brüggemann 2024 real-cohort-trained TAVR oracle
---

# brdav inference microservice

Wraps [Brüggemann et al. 2024 *Sci Rep*](https://www.nature.com/articles/s41598-024-63022-x)
([github.com/brdav/tavr](https://github.com/brdav/tavr), MIT licensed) as an HTTP service.

Loads the **Swin-UNETR checkpoint** (real-data-trained on 1,449 Zürich TAVR
patients, AUROC 0.725) once at startup and serves inference on POST `/infer`
with `~30 ms` per request after warmup.

## Endpoint

```
POST /infer
{
  "tabular": {"Age": 78, "BMI": 27, ...},
  "measurements": {"Area_of_annulus_incl_calcification": 510, ...}
}
→
{
  "probability": 0.512,
  "took_ms": 31
}
```

`null` values are marginalized out by the probabilistic model, so missing
features (e.g., AVA, mean gradient) are handled gracefully.

## Endpoint difference

brdav predicts **all-cause follow-up mortality** (months–years), not 30-day
mortality. The TAVI Risk Insight backend uses brdav's predictions for *rank
agreement* (Spearman ρ ≈ 0.53 vs. recalibrated STS-PROM across 5,000 patients)
rather than absolute probability comparison.

## Source repo

[github.com/Sjainish04/tavi-risk-insight](https://github.com/Sjainish04/tavi-risk-insight) — `external/tavr-server/`.
