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
      className="ibm-card p-1 flex md:flex-wrap gap-0.5 overflow-x-auto"
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
              "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-sm transition-colors flex-1 min-w-[100px] justify-center",
              isActive
                ? "bg-ibm-500 text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-50",
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
