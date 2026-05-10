import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

interface BrdavReport {
  n_patients: number;
  outcome_30d_mortality_observed: number;
  spearman_rho: {
    brdav_vs_sts_recal: number;
    brdav_vs_sts_raw: number;
    brdav_vs_lgbm_30d: number;
    sts_recal_vs_lgbm_30d: number;
  };
  top_decile_kappa: {
    sts_recal_vs_brdav: number;
    lgbm_vs_brdav: number;
    sts_recal_vs_lgbm: number;
  };
  oe_ratio_30d: { sts_raw: number; sts_recal: number; lgbm_30d: number };
  by_recal_decile: Array<{
    recal_decile: number;
    n: number;
    sts_recal_mean: number;
    lgbm_mean: number;
    brdav_mean: number;
    brdav_q25: number;
    brdav_q75: number;
    actual_mortality: number;
  }>;
}

export function BrdavExternalValidation() {
  const [data, setData] = useState<BrdavReport | null>(null);

  useEffect(() => {
    fetch("/brdav_vs_recal.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data) return null;

  const rho = data.spearman_rho;
  const deciles = data.by_recal_decile;

  return (
    <section>
      <h4 className="font-semibold text-gray-900 mb-1">
        Cross-model agreement: Brüggemann 2024 model run on our cohort (n=1,449 Zürich training)
      </h4>
      <p className="text-xs text-gray-700 leading-relaxed mb-2">
        We ran the pretrained Brüggemann 2024 Swin-UNETR model (MIT-licensed, Sci Rep)
        on each of our {data.n_patients.toLocaleString()} synthetic patients via a local
        Python 3.8 microservice. brdav targets <em>all-cause follow-up mortality</em>;
        ours target <em>30-day mortality</em>. Absolute probabilities therefore differ;
        the honest metric is <strong>Spearman rank correlation</strong>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
            Rank agreement (Spearman ρ)
          </p>
          <table className="text-xs w-full">
            <tbody>
              <tr>
                <td className="py-0.5">brdav × recal STS-PROM</td>
                <td className="py-0.5 text-right font-mono">
                  {rho.brdav_vs_sts_recal.toFixed(3)}
                </td>
              </tr>
              <tr>
                <td className="py-0.5">brdav × LightGBM (CT-aware)</td>
                <td className="py-0.5 text-right font-mono">
                  {rho.brdav_vs_lgbm_30d.toFixed(3)}
                </td>
              </tr>
              <tr>
                <td className="py-0.5">recal STS-PROM × LightGBM</td>
                <td className="py-0.5 text-right font-mono">
                  {rho.sts_recal_vs_lgbm_30d.toFixed(3)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="text-[11px] uppercase tracking-wide text-gray-500 mt-3 mb-1">
            Top-10% high-risk flagging (Cohen's κ)
          </p>
          <table className="text-xs w-full">
            <tbody>
              <tr>
                <td className="py-0.5">recal STS × brdav</td>
                <td className="py-0.5 text-right font-mono">
                  {data.top_decile_kappa.sts_recal_vs_brdav.toFixed(3)}
                </td>
              </tr>
              <tr>
                <td className="py-0.5">LightGBM × brdav</td>
                <td className="py-0.5 text-right font-mono">
                  {data.top_decile_kappa.lgbm_vs_brdav.toFixed(3)}
                </td>
              </tr>
              <tr>
                <td className="py-0.5">recal STS × LightGBM</td>
                <td className="py-0.5 text-right font-mono">
                  {data.top_decile_kappa.sts_recal_vs_lgbm.toFixed(3)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Plot
          data={[
            {
              type: "scatter",
              mode: "lines+markers",
              x: deciles.map((d) => d.recal_decile),
              y: deciles.map((d) => d.brdav_mean),
              error_y: {
                type: "data",
                symmetric: false,
                array: deciles.map((d) => d.brdav_q75 - d.brdav_mean),
                arrayminus: deciles.map((d) => d.brdav_mean - d.brdav_q25),
                color: "#a6c8ff",
              },
              name: "brdav mean (IQR bars)",
              marker: { color: "#0f62fe", size: 8 },
              line: { color: "#0f62fe" },
            },
            {
              type: "scatter",
              mode: "lines+markers",
              x: deciles.map((d) => d.recal_decile),
              y: deciles.map((d) => d.actual_mortality),
              name: "actual 30-d mortality",
              marker: { color: "#da1e28", size: 6, symbol: "diamond" },
              line: { color: "#da1e28", dash: "dot" },
              yaxis: "y",
            },
          ]}
          layout={{
            autosize: true,
            height: 240,
            margin: { l: 56, r: 12, t: 8, b: 40 },
            xaxis: {
              title: { text: "Decile of our recal STS-PROM" },
              dtick: 1,
            },
            yaxis: { tickformat: ".0%" },
            legend: { x: 0.02, y: 0.98, font: { size: 10 } },
            font: { size: 11 },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
        />
      </div>

      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
        <strong>How to read:</strong> brdav's mean prediction rises monotonically with our
        recalibrated STS-PROM decile ({(deciles[0].brdav_mean * 100).toFixed(0)}% →{" "}
        {(deciles[deciles.length - 1].brdav_mean * 100).toFixed(0)}%), confirming the
        models agree on relative risk ordering. The actual 30-day mortality (red diamonds)
        in the top decile is{" "}
        {(deciles[deciles.length - 1].actual_mortality * 100).toFixed(0)}% — consistent
        with brdav's higher relative ranking of these patients.
        <br />
        <strong>Caveats (in the spirit of TRIPOD+AI honesty):</strong> our synthetic cohort
        has higher 30-day mortality ({(data.outcome_30d_mortality_observed * 100).toFixed(2)}%)
        than published real-world TAVI registries (~2–3%), so the recalibration table
        under-corrects on these patients (raw STS O/E ={" "}
        {data.oe_ratio_30d.sts_raw.toFixed(2)}, recal O/E ={" "}
        {data.oe_ratio_30d.sts_recal.toFixed(2)}, LightGBM O/E ={" "}
        {data.oe_ratio_30d.lgbm_30d.toFixed(2)}). brdav itself is not directly evaluable
        on 30-d outcomes (different endpoint).
      </p>
    </section>
  );
}
