import { Edit3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AnnularSizingTable } from "@/components/AnnularSizingTable";
import { ComplicationsTable } from "@/components/ComplicationsTable";
import { CoronaryRiskCard } from "@/components/CoronaryRiskCard";
import { EhrExportActions } from "@/components/EhrExportActions";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { FutilityBanner } from "@/components/FutilityBanner";
import { Header } from "@/components/Header";
import { HeartTeamSummary } from "@/components/HeartTeamSummary";
import { ModelCardTab } from "@/components/ModelCardTab";
import { ModelROCCurves } from "@/components/ModelROCCurves";
import { PatientForm } from "@/components/PatientForm";
import { PatientHeader } from "@/components/PatientHeader";
import { PredictedVsObservedCalibration } from "@/components/PredictedVsObservedCalibration";
import { RiskComparison } from "@/components/RiskComparison";
import { RiskFactorProfile } from "@/components/RiskFactorProfile";
import { SensitivityAnalysis } from "@/components/SensitivityAnalysis";
import { SeverityCard } from "@/components/SeverityCard";
import { ShapWaterfall } from "@/components/ShapWaterfall";
import { SpecialConsiderationsCard } from "@/components/SpecialConsiderationsCard";
import { SurvivalCurve } from "@/components/SurvivalCurve";
import { WorkspaceNav, type WorkspaceView } from "@/components/WorkspaceNav";
import { cn } from "@/lib/utils";
import { usePrediction } from "@/store/prediction";

type Tab = "results" | "modelcard";

function App() {
  const [tab, setTab] = useState<Tab>("results");
  const [view, setView] = useState<WorkspaceView>("summary");
  const [formCollapsed, setFormCollapsed] = useState(false);
  const error = usePrediction((s) => s.error);
  const result = usePrediction((s) => s.result);
  const lastInput = usePrediction((s) => s.lastInput);

  // New result → land on Summary, auto-collapse form to free up width
  useEffect(() => {
    if (result) {
      setView("summary");
      setFormCollapsed(true);
    }
  }, [result]);

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
            {!formCollapsed && (
              <aside className="lg:col-span-4">
                <PatientForm />
              </aside>
            )}

            <section
              className={cn(
                "space-y-4",
                formCollapsed ? "lg:col-span-12" : "lg:col-span-8",
              )}
            >
              {error && (
                <div className="ibm-card border-red-300 bg-red-50 p-3 text-sm text-red-900">
                  {error}
                </div>
              )}

              {!result && !error && (
                <div className="ibm-card p-8 text-center">
                  <p className="text-sm text-gray-700 font-medium">
                    Submit a case to start.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Pull a demo from the EHR or fill the form on the left. We compute
                    severity, three risk scores, complications, and per-device sizing in
                    under 2 seconds.
                  </p>
                </div>
              )}

              {result && formCollapsed && (
                <div className="flex justify-end -mb-2">
                  <button
                    type="button"
                    onClick={() => setFormCollapsed(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-sm transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit case
                  </button>
                </div>
              )}

              {result && (
                <>
                  {/* Futility lives above the workspace nav — too urgent to hide behind a tab */}
                  <FutilityBanner />

                  <WorkspaceNav active={view} onChange={setView} />

                  {view === "summary" && <HeartTeamSummary onNavigate={setView} />}

                  {view === "triage" && <SeverityCard />}

                  {view === "risk" && (
                    <>
                      <RiskComparison />
                      <ComplicationsTable />
                    </>
                  )}

                  {view === "devices" && (
                    <>
                      <AnnularSizingTable />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CoronaryRiskCard />
                        <SpecialConsiderationsCard />
                      </div>
                    </>
                  )}

                  {view === "note" && (
                    <>
                      <ExplanationPanel />
                      <EhrExportActions />
                    </>
                  )}

                  {view === "visual" && (
                    <>
                      <ShapWaterfall />
                      <SurvivalCurve />
                      <PredictedVsObservedCalibration />
                      <RiskFactorProfile />
                      <SensitivityAnalysis />
                      <ModelROCCurves />
                    </>
                  )}
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
