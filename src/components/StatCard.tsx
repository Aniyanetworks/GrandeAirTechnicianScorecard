interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "green" | "amber" | "red" | "gray";
}

const accentMap = {
  blue:  "border-l-blue-500 bg-blue-50",
  green: "border-l-emerald-500 bg-emerald-50",
  amber: "border-l-amber-500 bg-amber-50",
  red:   "border-l-red-500 bg-red-50",
  gray:  "border-l-gray-400 bg-gray-50",
};

const valueMap = {
  blue:  "text-blue-700",
  green: "text-emerald-700",
  amber: "text-amber-700",
  red:   "text-red-700",
  gray:  "text-gray-700",
};

export default function StatCard({ label, value, sub, accent = "blue" }: Props) {
  return (
    <div className={`card border-l-4 ${accentMap[accent]} px-5 py-4`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueMap[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
