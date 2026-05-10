import Plot from "react-plotly.js";

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

  // Color: red if riskier, green if healthier
  const colors = deviations.map((d) => (d > 0 ? "#da1e28" : "#198038"));

  // Hover labels with patient + registry values
  const hoverText = factors.map(
    (fac) =>
      `${fac.name}: patient ${fac.patient.toFixed(1)} ${fac.unit} · PARTNER 3 avg ${fac.avg.toFixed(1)} ${fac.unit}`,
  );

  return (
    <div className="ibm-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        Risk factor profile · this patient vs PARTNER 3 average
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        Standardised deviation from a low-risk TAVR cohort. Bars to the right (red) flag
        outlier factors driving risk up; bars to the left (green) are protective.
      </p>
      <Plot
        data={[
          {
            type: "bar",
            orientation: "h",
            x: deviations,
            y: factors.map((fac) => fac.name),
            marker: { color: colors },
            text: factors.map((fac) => `${fac.patient.toFixed(1)} ${fac.unit}`),
            textposition: "outside",
            customdata: hoverText,
            hovertemplate: "%{customdata}<extra></extra>",
          },
        ]}
        layout={{
          height: 240,
          margin: { l: 90, r: 50, t: 10, b: 40 },
          xaxis: {
            title: { text: "← healthier · standardised units · riskier →" },
            zeroline: true,
            zerolinecolor: "#525252",
            zerolinewidth: 2,
            range: [-3, 3],
          },
          yaxis: { tickfont: { size: 11 } },
          font: { family: "IBM Plex Sans, sans-serif", size: 11 },
          paper_bgcolor: "white",
          plot_bgcolor: "white",
          showlegend: false,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%" }}
      />
    </div>
  );
}
