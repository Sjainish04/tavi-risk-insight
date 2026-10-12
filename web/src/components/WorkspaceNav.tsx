import { Activity, AlertCircle, BarChart3, Cpu, FileText, Star } from "lucide-react";

import { cn } from "@/lib/utils";

export type WorkspaceView =
  | "summary"
  | "triage"
  | "risk"
  | "devices"
  | "note"
  | "visual";

const VIEWS: {
  id: WorkspaceView;
  label: string;
  icon: typeof Star;
}[] = [
  { id: "summary", label: "Summary", icon: Star },
  { id: "triage", label: "Triage", icon: Activity },
  { id: "risk", label: "Risk", icon: AlertCircle },
  { id: "devices", label: "Devices", icon: Cpu },
  { id: "note", label: "Note", icon: FileText },
  { id: "visual", label: "Visual analysis", icon: BarChart3 },
];

interface Props {
  active: WorkspaceView;
  onChange: (v: WorkspaceView) => void;
}

export function WorkspaceNav({ active, onChange }: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Heart Team workspace sections"
      className="ibm-card p-1.5 flex md:flex-wrap gap-1 overflow-x-auto"
    >
      {VIEWS.map((v) => {
        const isActive = v.id === active;
        const Icon = v.icon;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(v.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all flex-1 min-w-[110px] justify-center whitespace-nowrap",
              isActive
                ? "bg-gradient-to-b from-ibm-500 to-ibm-600 text-white shadow-glow"
                : "text-gray-600 hover:bg-ibm-50 hover:text-ibm-700",
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{v.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
