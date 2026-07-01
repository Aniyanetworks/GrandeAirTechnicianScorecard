import WeeklyReport from "@/components/reports/WeeklyReport";

export default function WeeklyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-brand-navy">Weekly Report</h1>
        <p className="text-sm text-gray-500 mt-0.5">Team performance snapshot for the selected week</p>
      </div>
      <WeeklyReport />
    </div>
  );
}
