import QuarterlyReport from "@/components/reports/QuarterlyReport";

export default function QuarterlyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-brand-navy">Quarterly Scorecard</h1>
        <p className="text-sm text-gray-500 mt-0.5">3-month rollup — for raises, reviews &amp; offer letters</p>
      </div>
      <QuarterlyReport />
    </div>
  );
}
