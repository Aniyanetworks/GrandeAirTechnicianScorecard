import MonthlyReport from "@/components/reports/MonthlyReport";

export default function MonthlyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-brand-navy">Monthly Scorecard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Auto-calculated from weekly entries</p>
      </div>
      <MonthlyReport />
    </div>
  );
}
