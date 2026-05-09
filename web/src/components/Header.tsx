import { Activity, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

interface HeaderProps {
  tab: "results" | "modelcard";
  onTabChange: (t: "results" | "modelcard") => void;
}

export function Header({ tab, onTabChange }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-ibm-500 flex items-center justify-center rounded-sm">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">
              TAVI Risk Insight
            </h1>
            <p className="text-xs text-gray-500 leading-tight">
              Decision support for the structural heart team
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavButton
            active={tab === "results"}
            onClick={() => onTabChange("results")}
            icon={<Activity className="w-4 h-4" />}
            label="Heart Team Workspace"
          />
          <NavButton
            active={tab === "modelcard"}
            onClick={() => onTabChange("modelcard")}
            icon={<FileText className="w-4 h-4" />}
            label="Model Card"
          />
        </nav>

        <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            watsonx.ai · au-syd
          </span>
        </div>
      </div>
    </header>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors",
        active
          ? "bg-ibm-50 text-ibm-700 border border-ibm-200"
          : "text-gray-600 hover:bg-gray-50 border border-transparent",
      )}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
