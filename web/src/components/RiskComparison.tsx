import { ArrowDownRight, ArrowUpRight, Minus, Wrench } from "lucide-react";

import type { RiskScoreDriver } from "@/lib/types";
import { RISK_BAND_CHIP, RISK_BAND_LABEL, cn, fmtPct, riskBand } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

interface CardProps {
  title: string;
  subtitle: string;
  pct: number | null;
  highlight?: "primary" | "neutral";
  delta?: number | null;
  note?: string | null;
  badge?: string;
  footer?: React.ReactNode;
}

function MlFooter({
  p,
  ci,
  decile,
  baseRateMultiplier,
  drivers,
}: {
  p: number;
  ci: [number, number];
  decile: number;
  baseRateMultiplier: number;
  drivers: RiskScoreDriver[];
}) {
  const topDrivers = drivers.slice(0, 3);
  const band = riskBand(p);
  return (
    <div className="space-y-1.5 pt-1.5 border-t border-gray-100">
      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
        <span
          className={cn(
            "uppercase tracking-wider font-semibold px-1.5 py-px border rounded-sm",
            RISK_BAND_CHIP[band],
          )}
        >
          {RISK_BAND_LABEL[band]}
        </span>
        <span className="font-mono text-gray-700">
          CI {fmtPct(ci[0])}–{fmtPct(ci[1])}
        </span>
        <span className="font-mono px-1 py-px bg-gray-100 text-gray-700 rounded-sm">
          Decile {decile}/9
        </span>
        <span className="font-mono px-1 py-px bg-ibm-50 text-ibm-700 rounded-sm">
          {baseRateMultiplier.toFixed(2)}× base
        </span>
      </div>
      {topDrivers.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Top drivers</div>
          <ul className="space-y-0.5">
            {topDrivers.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug">
                <span
                  className={cn(
                    "mt-0.5 flex-shrink-0",
                    d.effect === "increases" ? "text-red-600" : "text-emerald-600",
                  )}
                >
                  {d.effect === "increases" ? "↑" : "↓"}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-gray-800">{d.feature_label}</span>
                  {d.is_modifiable && (
                    <span
                      className="ml-1 inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-1 py-px rounded-sm"
                      title={d.modify_to ?? "modifiable"}
                    >
                      <Wrench className="w-2.5 h-2.5" />
                      modifiable
                    </span>
                  )}
                  {d.is_modifiable && d.modify_to && (
                    <span className="block text-[10px] text-amber-800 leading-snug">
                      → target {d.modify_to}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RiskCard({ title, subtitle, pct, highlight, delta, note, badge, footer }: CardProps) {
  const accent = highlight === "primary" ? "ring-1 ring-ibm-500" : "";
  const deltaLabel =
    delta == null
      ? null
      : Math.abs(delta) < 0.0005
        ? { icon: <Minus className="w-3 h-3" />, text: "no shift", cls: "text-gray-500" }
        : delta > 0
          ? {
              icon: <ArrowUpRight className="w-3 h-3" />,
              text: `+${(delta * 100).toFixed(2)} pp`,
              cls: "text-amber-600",
            }
          : {
              icon: <ArrowDownRight className="w-3 h-3" />,
              text: `${(delta * 100).toFixed(2)} pp`,
              cls: "text-emerald-600",
            };

  return (
    <div className={cn("ibm-card p-3 space-y-1.5", accent)}>
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
        {badge && (
          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 bg-gray-100 text-gray-600 rounded-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-mono font-semibold text-gray-900">
          {pct == null ? "—" : fmtPct(pct)}
        </span>
        {deltaLabel && (
          <span className={cn("flex items-center text-[10px]", deltaLabel.cls)}>
            {deltaLabel.icon}
            <span className="ml-0.5">{deltaLabel.text}</span>
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-600 leading-snug">{subtitle}</p>
      {note && <p className="text-[11px] text-gray-500 italic leading-snug">{note}</p>}
      {footer}
    </div>
  );
}

export function RiskComparison() {
  const result = usePrediction((s) => s.result);

  if (!result) {
    return (
      <div className="ibm-card p-6 text-sm text-gray-500 text-center">
        Submit the form to see calibrated risk estimates.
      </div>
    );
  }

  const stsRaw = result.sts_prom.raw_probability;
  const stsRecal = result.sts_prom.recalibrated_probability ?? stsRaw;
  const delta = stsRecal - stsRaw;

  const isStacking = result.primary_model_name === "v3_stacking_brdav";
  const primaryTitle = isStacking ? "Stacking ensemble" : "LightGBM";
  const primarySubtitle = isStacking
    ? "v3 winner: LGBM + CatBoost + LR + brdav. Bootstrap AUROC 0.78."
    : "Cross-check on synthetic registry. CT-aware.";
  const primaryBadge = isStacking ? "ML · v3" : "ML";

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 px-1">
        30-day mortality estimates · ensemble of validated calculators
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <RiskCard
          title="STS-PROM (raw)"
          subtitle="2018 v2.9 reduced-form. Trained on SAVR cohorts."
          pct={stsRaw}
          highlight="neutral"
          badge="SAVR"
          note="Miscalibrated for modern TAVI."
        />
        <RiskCard
          title="STS-PROM (recalibrated)"
          subtitle="Era-aware O/E correction from published TAVI registries."
          pct={stsRecal}
          delta={delta}
          highlight="primary"
          badge="TAVI era"
        />
        <RiskCard
          title="ACC/STS TVT"
          subtitle="Edwards 2016. Powers tools.acc.org/tavrrisk."
          pct={result.tvt.raw_probability}
          highlight="neutral"
          badge="TAVI native"
          note="Slope 0.83 — best-calibrated external score."
        />
        <RiskCard
          title={primaryTitle}
          subtitle={primarySubtitle}
          pct={result.lgbm.raw_probability}
          highlight={isStacking ? "primary" : "neutral"}
          badge={primaryBadge}
          footer={
            <MlFooter
              p={result.lgbm.raw_probability}
              ci={result.lgbm_ci}
              decile={result.lgbm_decile}
              baseRateMultiplier={result.lgbm_base_rate_comparison}
              drivers={result.risk_score_drivers}
            />
          }
        />
      </div>

      {result.brdav && (
        <div className="ibm-card p-3 bg-blue-50 border-l-4 border-ibm-500 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
              5th opinion · Brüggemann 2024 oracle
              <span className="ml-2 text-[9px] uppercase px-1 py-0.5 bg-ibm-500 text-white rounded-sm">
                real cohort · n=1,449
              </span>
            </h3>
            <span className="text-2xl font-mono font-semibold text-gray-900">
              {fmtPct(result.brdav.raw_probability)}
            </span>
          </div>
          <p className="text-[11px] text-gray-700 leading-snug">
            <strong>Different endpoint</strong>: brdav predicts all-cause follow-up
            mortality (months–years), not 30-day. Direct probability comparison would
            mislead — the value is in <em>rank agreement</em> with our recalibrated
            scores (Spearman ρ ≈ 0.53 across 5,000 patients — see Model Card).
            {result.brdav.miscalibration_note && (
              <span className="text-gray-500 italic"> · {result.brdav.miscalibration_note}</span>
            )}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
        <span>EuroSCORE II: {fmtPct(result.euroscore_ii.raw_probability)} · for reference</span>
        <span>
          Ensemble agreement: {ensembleAgreement(
            stsRecal,
            result.tvt.raw_probability,
            result.lgbm.raw_probability,
          )}
        </span>
      </div>
    </div>
  );
}

function ensembleAgreement(...probs: number[]): string {
  const max = Math.max(...probs);
  const min = Math.min(...probs);
  const spread = max - min;
  if (spread < 0.015) return "tight (within 1.5 pp)";
  if (spread < 0.04) return "moderate";
  return `wide (${(spread * 100).toFixed(1)} pp)`;
}
