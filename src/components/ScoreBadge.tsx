import type { ScoreColor } from "@/lib/types";

interface Props {
  color: ScoreColor;
  score?: number;
  size?: "sm" | "md" | "lg";
}

const colorMap: Record<ScoreColor, string> = {
  GREEN:  "bg-emerald-100 text-emerald-800 border-emerald-300",
  YELLOW: "bg-amber-100 text-amber-800 border-amber-300",
  RED:    "bg-red-100 text-red-700 border-red-300",
};

const dotMap: Record<ScoreColor, string> = {
  GREEN:  "bg-emerald-500",
  YELLOW: "bg-amber-500",
  RED:    "bg-red-500",
};

const sizeMap = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5 font-bold",
};

export default function ScoreBadge({ color, score, size = "md" }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${colorMap[color]} ${sizeMap[size]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color]}`} />
      {score !== undefined ? `${score}` : color}
      {score !== undefined && <span className="opacity-60 font-normal text-xs">/ 100</span>}
    </span>
  );
}
