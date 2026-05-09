import { useMemo, useState } from "react";

import { AnnularSizingTable } from "@/components/AnnularSizingTable";
import { CalibrationPlot } from "@/components/CalibrationPlot";
import { ComplicationsTable } from "@/components/ComplicationsTable";
import { CoronaryRiskCard } from "@/components/CoronaryRiskCard";
import { DecisionCurvePlot } from "@/components/DecisionCurvePlot";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { FutilityBanner } from "@/components/FutilityBanner";
import { Header } from "@/components/Header";
import { MiscalibrationBanner } from "@/components/MiscalibrationBanner";
import { ModelCardTab } from "@/components/ModelCardTab";
import { PatientForm } from "@/components/PatientForm";
import { PatientHeader } from "@/components/PatientHeader";
import { RiskComparison } from "@/components/RiskComparison";
import { SeverityCard } from "@/components/SeverityCard";
import { ShapWaterfall } from "@/components/ShapWaterfall";
import { SpecialConsiderationsCard } from "@/components/SpecialConsiderationsCard";
import { usePrediction } from "@/store/prediction";

type Tab = "results" | "modelcard";

function App() {
  const [tab, setTab] = useState<Tab>("results");
  const error = usePrediction((s) => s.error);
  const result = usePrediction((s) => s.result);
  const lastInput = usePrediction((s) => s.lastInput);

  // Stable case ID derived from a hash of the patient features
  const caseId = useMemo(() => {
    if (!lastInput) return "TVI-····-····";
    let hash = 0;
    const s = JSON.stringify(lastInput);
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) & 0x7fffffff;
    }
    return `TVI-2026-${String(hash % 10000).padStart(4, "0")}`;
  }, [lastInput]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header tab={tab} onTabChange={setTab} />
      {lastInput && <PatientHeader values={lastInput} caseId={caseId} />}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "results" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <aside className="lg:col-span-4">
              <PatientForm />
            </aside>

            <section className="lg:col-span-8 space-y-4">
              {error && (
                <div className="ibm-card border-red-300 bg-red-50 p-3 text-sm text-red-900">
                  {error}
                </div>
              )}

              {result && (
                <>
                  <SeverityCard />
                  <FutilityBanner />
                </>
              )}

              <RiskComparison />
              <MiscalibrationBanner />

              {result && (
                <>
                  <ComplicationsTable />
                  <AnnularSizingTable />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CoronaryRiskCard />
                    <SpecialConsiderationsCard />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CalibrationPlot />
                    <DecisionCurvePlot />
                  </div>
                  <ShapWaterfall />
                  <ExplanationPanel />
                </>
              )}
            </section>
          </div>
        ) : (
          <ModelCardTab />
        )}
      </main>
    </div>
  );
}

export default App;
