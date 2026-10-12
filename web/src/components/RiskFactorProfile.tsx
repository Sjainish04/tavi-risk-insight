import { COLORS, Plot, alpha, config, layout } from "@/lib/plot";

import { usePrediction } from "@/store/prediction";

interface Factor {
  name: string;
  patient: number;
  avg: number;
  scale: number;       // typical clinical SD-like scale
  protective: boolean; // true → lower value = higher risk (so we flip sign)
  unit: string;
}

// PARTNER 3 / Evolut Low Risk era population averages (low-risk TAVR cohort)
const PARTNER3_AVG = {
  age: 73,
  lvef: 65,
  egfr: 75,
  hemoglobin: 13.4,
  albumin: 4.1,
  gait_speed: 0.95,
  nyha: 2,
};

function num(v: number | string | boolean | null | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function RiskFactorProfile() {
  const result = usePrediction((s) => s.result);
  if (!result) return null;
  const f = result.feature_summary;

  const factors: Factor[] = [
    {
      name: "Age",
      patient: num(f["age_years"], PARTNER3_AVG.age),
      avg: PARTNER3_AVG.age,
      scale: 8,
      protective: false,
      unit: "y",
    },
    {
      name: "LVEF",
      patient: num(f["lvef_pct"], PARTNER3_AVG.lvef),
      avg: PARTNER3_AVG.lvef,
      scale: 12,
      protective: true,
      unit: "%",
    },
    {
      name: "eGFR",
      patient: num(f["egfr"], PARTNER3_AVG.egfr),
      avg: PARTNER3_AVG.egfr,
      scale: 18,
      protective: true,
      unit: "mL/min",
    },
    {
      name: "Hemoglobin",
      patient: num(f["hemoglobin_g_dl"], PARTNER3_AVG.hemoglobin),
      avg: PARTNER3_AVG.hemoglobin,
      scale: 1.6,
      protective: true,
      unit: "g/dL",
    },
    {
      name: "Albumin",
      patient: num(f["albumin_g_dl"], PARTNER3_AVG.albumin),
      avg: PARTNER3_AVG.albumin,
      scale: 0.4,
      protective: true,
      unit: "g/dL",
    },
    {
      name: "Gait speed",
      patient: num(f["gait_speed_m_per_s"], PARTNER3_AVG.gait_speed),
      avg: PARTNER3_AVG.gait_speed,
      scale: 0.18,
      protective: true,
      unit: "m/s",
    },
  ];

  // Deviation in SD-like units; positive = riskier than registry, negative = healthier
  const deviations = factors.map((fac) => {
    const raw = (fac.patient - fac.avg) / fac.scale;
    return fac.protective ? -raw : raw;
  });

  // Rose if riskier, emerald if healthier; the further from the registry
  // average, the stronger the fill, so the biggest outliers stand out first.
  const colors = deviations.map((d) =>
    alpha(d > 0 ? COLORS.increases : COLORS.decreases, 0.35 + Math.min(0.6, Math.abs(d) / 3)),
  );
  const outlines = deviations.map((d) => (d > 0 ? COLORS.increases : COLORS.decreases));

  // Hover labels with patient + registry values
  const hoverText = factors.map(
    (fac) =>
      `${fac.name}: patient ${fac.patient.toFixed(1)} ${fac.unit} · PARTNER 3 avg ${fac.avg.toFixed(1)} ${fac.unit}`,
  );

  return (
    <div className="ibm-card p-4">
      <p className="eyebrow">Patient profile</p>
      <h3 className="card-title mb-1">This patient vs the PARTNER 3 average</h3>
      <p className="text-xs text-gray-500 mb-2">
        Standardised deviation from a low-risk TAVR cohort. Bars to the right (rose) flag
        outlier factors driving risk up; bars to the left (emerald) are protective.
      </p>
      <div className="figure-plate px-1 pt-2">
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            x: deviations,
            y: factors.map((fac) => fac.name),
            marker: { color: colors, line: { color: outlines, width: 1.5 } },
            text: factors.map((fac) => `${fac.patient.toFixed(1)} ${fac.unit}`),
            textposition: "outside",
            textfont: { family: "ui-monospace, Menlo, monospace", size: 11 },
            cliponaxis: false,
            customdata: hoverText,
            hovertemplate: "%{customdata}<extra></extra>",
          },
        ]}
        layout={layout({
          height: 270,
          margin: { l: 12, r: 64, t: 8, b: 48 },
          bargap: 0.35,
          xaxis: {
            title: { text: "← healthier · standardised units · riskier →" },
            zeroline: true,
            zerolinecolor: COLORS.ink,
            zerolinewidth: 2,
            range: [-3, 3],
          },
          yaxis: { tickfont: { size: 12, color: COLORS.ink }, showgrid: false },
          showlegend: false,
          // The two halves of the axis, tinted, so direction reads before the bars do.
          shapes: [
            { type: "rect", xref: "x", yref: "paper", x0: -3, x1: 0, y0: 0, y1: 1, fillcolor: alpha(COLORS.decreases, 0.04), line: { width: 0 }, layer: "below" },
            { type: "rect", xref: "x", yref: "paper", x0: 0, x1: 3, y0: 0, y1: 1, fillcolor: alpha(COLORS.increases, 0.04), line: { width: 0 }, layer: "below" },
          ],
        })}
        config={config("risk-factor-profile")}
        style={{ width: "100%" }}
      />
      </div>
    </div>
  );
}
