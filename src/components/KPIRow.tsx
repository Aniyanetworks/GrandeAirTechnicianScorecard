import type { KPIScore } from "@/lib/types";

interface Props { kpi: KPIScore }

const barColor: Record<string, string> = {
  GREEN:  "bg-emerald-500",
  YELLOW: "bg-amber-500",
  RED:    "bg-red-500",
};

const textColor: Record<string, string> = {
  GREEN:  "text-emerald-700",
  YELLOW: "text-amber-700",
  RED:    "text-red-700",
};

export default function KPIRow({ kpi }: Props) {
  const pct = Math.max(0, Math.min(100, kpi.score));
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-40 flex-shrink-0">
        <p className="text-sm font-medium text-gray-700 leading-tight">{kpi.name}</p>
        <p className="text-xs text-gray-400">target {kpi.target}</p>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor[kpi.color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-20 text-right">
        <span className={`text-sm font-semibold ${textColor[kpi.color]}`}>{kpi.actual}</span>
      </div>
      <div className="w-10 text-right">
        <span className="text-xs font-bold text-gray-500">{Math.round(kpi.score)}</span>
      </div>
    </div>
  );
}
