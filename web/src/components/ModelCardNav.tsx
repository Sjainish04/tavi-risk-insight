import { BookOpen, Cpu, Microscope, ScaleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ModelCardView = "overview" | "methods" | "this-case" | "validation";

const VIEWS: {
  id: ModelCardView;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "methods", label: "Methods", icon: Microscope },
  { id: "this-case", label: "On this case", icon: Cpu },
  { id: "validation", label: "Validation", icon: ScaleIcon },
];

interface Props {
  active: ModelCardView;
  onChange: (v: ModelCardView) => void;
}

export function ModelCardNav({ active, onChange }: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Model card sections"
      className="flex flex-wrap gap-0.5 border-b border-gray-200 -mt-1"
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
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              isActive
                ? "text-ibm-700 border-ibm-500"
                : "text-gray-600 border-transparent hover:text-ibm-600 hover:border-gray-300",
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
