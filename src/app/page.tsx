"use client";

import { useState } from "react";
import OverviewReport   from "@/components/reports/OverviewReport";
import WeeklyReport     from "@/components/reports/WeeklyReport";
import MonthlyReport    from "@/components/reports/MonthlyReport";
import QuarterlyReport  from "@/components/reports/QuarterlyReport";

const TABS = [
  { key: "overview",   label: "Overview",         icon: "⊞" },
  { key: "weekly",     label: "Weekly Report",    icon: "📅" },
  { key: "monthly",    label: "Monthly Scorecard", icon: "📊" },
  { key: "quarterly",  label: "Quarterly Review",  icon: "🏆" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-0">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-brand-navy">Team Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Grande Air Solutions · Austin, TX · $2.3M Revenue Goal</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center ${
              activeTab === tab.key
                ? "bg-white text-brand-navy shadow-sm border border-gray-200"
                : "text-gray-500 hover:text-brand-navy hover:bg-white/50"
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-orange ml-1" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview"  && <OverviewReport />}
        {activeTab === "weekly"    && <WeeklyReport />}
        {activeTab === "monthly"   && <MonthlyReport />}
        {activeTab === "quarterly" && <QuarterlyReport />}
      </div>
    </div>
  );
}
