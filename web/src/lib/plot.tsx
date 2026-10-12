import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import type { Config, Layout, LayoutAxis } from "plotly.js-basic-dist-min";

/** react-plotly bound to the basic Plotly bundle (scatter + bar + pie).
 *
 *  The default `react-plotly.js` import pulls in the full Plotly build, about
 *  4 MB of chart types this app never draws. Every chart here is a scatter or a
 *  bar, so the basic bundle is enough and the page loads far faster. */
export const Plot = createPlotlyComponent(Plotly);

/** Chart palette. Hues are fixed per meaning across every figure, so "raises
 *  risk" is the same rose and LightGBM the same blue wherever they appear. */
export const COLORS = {
  ibm: "#0f62fe",
  ibmDark: "#0043ce",
  increases: "#e11d48", // rose: raises risk
  decreases: "#059669", // emerald: lowers risk
  modifiable: "#d97706", // amber: raises risk, but can be changed
  neutral: "#94a3b8",
  ink: "#0b1a33",
  low: "#059669",
  intermediate: "#d97706",
  high: "#e11d48",
  grid: "#e9eef5",
  axis: "#cbd5e1",
  text: "#334155",
  muted: "#64748b",
} as const;

/** One series colour per scoring model, shared by every comparison figure. */
export const MODEL_COLORS = {
  stsRaw: "#94a3b8",
  stsRecal: "#d97706",
  tvt: "#0d9488",
  euroscore: "#7c3aed",
  lgbm: "#0f62fe",
  brdav: "#e11d48",
} as const;

/** A hex colour at the given opacity, as rgba(). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const FONT = '"Times New Roman", Times, serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Axis styling: light horizontal rules, a firm baseline, monospaced ticks. */
export function axis(overrides: Partial<LayoutAxis> = {}): Partial<LayoutAxis> {
  const { title, ...rest } = overrides;
  const titleObject = typeof title === "string" ? { text: title } : (title ?? {});
  return {
    gridcolor: COLORS.grid,
    linecolor: COLORS.axis,
    zerolinecolor: COLORS.axis,
    tickfont: { family: MONO, size: 10, color: COLORS.muted },
    automargin: true,
    ...rest,
    // Merged rather than replaced, so a caller's title text keeps the shared font.
    title: { font: { family: FONT, size: 12, color: COLORS.text }, ...titleObject },
  };
}

/** Layout skeleton for every figure. Callers pass what is specific to them. */
export function layout(overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    font: { family: FONT, size: 11, color: COLORS.text },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 56, r: 16, t: 12, b: 48 },
    hoverlabel: {
      bgcolor: "#ffffff",
      bordercolor: COLORS.axis,
      font: { family: FONT, size: 12, color: COLORS.ink },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: -0.22,
      font: { size: 11, color: COLORS.text },
      bgcolor: "rgba(0,0,0,0)",
    },
    transition: { duration: 500, easing: "cubic-in-out" },
    ...overrides,
    xaxis: axis(overrides.xaxis ?? {}),
    yaxis: axis(overrides.yaxis ?? {}),
  };
}

/** Toolbar on hover only, with a PNG export at twice screen resolution for
 *  slides and the Heart Team record. */
export function config(filename: string): Partial<Config> {
  return {
    responsive: true,
    displaylogo: false,
    displayModeBar: "hover",
    modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toggleSpikelines"],
    toImageButtonOptions: { format: "png", filename: `tavi-${filename}`, scale: 2 },
  };
}
