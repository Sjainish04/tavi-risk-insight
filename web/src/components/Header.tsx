import { FileText, HeartPulse, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

import { getHealth, type HealthInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

interface HeaderProps {
  tab: "results" | "modelcard";
  onTabChange: (t: "results" | "modelcard") => void;
}

type Status = "checking" | "online" | "waking";

/** Reads /healthz once on load. The backend runs on free hosting that sleeps
 *  when idle, so a slow or failed first answer usually means it is starting,
 *  not that it is down; the pill says so rather than showing a fixed green dot. */
function useBackendStatus(): { status: Status; info: HealthInfo | null } {
  const [status, setStatus] = useState<Status>("checking");
  const [info, setInfo] = useState<HealthInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const check = () => {
      getHealth()
        .then((h) => {
          if (cancelled) return;
          setInfo(h);
          setStatus("online");
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("waking");
          attempts += 1;
          if (attempts < 6) setTimeout(check, 10000);
        });
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);
  return { status, info };
}

export function Header({ tab, onTabChange }: HeaderProps) {
  const { status, info } = useBackendStatus();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ibm-400 via-ibm-500 to-ibm-700 flex items-center justify-center shadow-glow flex-shrink-0">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight tracking-tight">
              TAVI Risk <span className="text-ibm-600">Insight</span>
            </h1>
            <p className="text-xs text-gray-500 leading-tight truncate">
              Decision support for the structural heart team
            </p>
          </div>
        </div>

        <nav
          aria-label="Main views"
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1"
        >
          <NavButton
            active={tab === "results"}
            onClick={() => onTabChange("results")}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Heart Team Workspace"
          />
          <NavButton
            active={tab === "modelcard"}
            onClick={() => onTabChange("modelcard")}
            icon={<FileText className="w-4 h-4" />}
            label="Model Card"
          />
        </nav>

        <div
          className="hidden md:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm"
          title={info ? `Backend ${info.version}, model loaded: ${info.model_loaded ? "yes" : "no"}` : undefined}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              status === "online" && "bg-emerald-500",
              status === "waking" && "bg-amber-500 animate-pulse-dot",
              status === "checking" && "bg-slate-400 animate-pulse-dot",
            )}
          />
          {status === "online" && (
            <span>
              Online · {info?.llm_provider ?? "watsonx.ai"} · {info?.region ?? "au-syd"}
            </span>
          )}
          {status === "waking" && <span>Server waking up</span>}
          {status === "checking" && <span>Connecting</span>}
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
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
        active
          ? "bg-white text-ibm-700 shadow-sm ring-1 ring-slate-200"
          : "text-gray-600 hover:text-gray-900",
      )}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
