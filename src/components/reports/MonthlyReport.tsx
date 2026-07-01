"use client";

import { useEffect, useState } from "react";
import { getTechnicians, getEntriesForTechMonth } from "@/lib/store";
import { buildMonthlyScorecard, getCurrentMonth, monthLabel, formatCurrency } from "@/lib/calculations";
import type { Technician, MonthlyScorecard } from "@/lib/types";
import ScoreBadge from "@/components/ScoreBadge";
import KPIRow from "@/components/KPIRow";

export default function MonthlyReport() {
  const [techs, setTechs]   = useState<Technician[]>([]);
  const [techId, setTechId] = useState("");
  const [month, setMonth]   = useState(getCurrentMonth());
  const [card, setCard]     = useState<MonthlyScorecard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTechs() {
      try {
        const t = await getTechnicians();
        setTechs(t);
        setTechId(t[0]?.id || "");
      } catch (err) {
        console.error("Failed to load technicians:", err);
      }
    }
    loadTechs();
  }, []);

  useEffect(() => {
    if (!techId) return;
    async function loadCard() {
      setLoading(true);
      try {
        const entries = await getEntriesForTechMonth(techId, month);
        setCard(buildMonthlyScorecard(techId, month, entries));
      } catch (err) {
        console.error("Failed to load monthly data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCard();
  }, [techId, month]);

  const tech = techs.find((t) => t.id === techId);
  const totalJobs    = card?.weeklyEntries.reduce((s, e) => s + e.jobsCompleted, 0) ?? 0;
  const totalRevenue = card?.weeklyEntries.reduce((s, e) => s + e.totalRevenue, 0) ?? 0;
  const totalMAS     = card?.weeklyEntries.reduce((s, e) => s + e.maintenanceAgreementsSold, 0) ?? 0;
  const coachFocus   = card?.kpis.filter((k) => k.color !== "GREEN").sort((a, b) => a.score - b.score).slice(0, 2) ?? [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={techId} onChange={(e) => setTechId(e.target.value)} className="input w-52" disabled={techs.length === 0}>
          {techs.length === 0
            ? <option>No technicians</option>
            : techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)
          }
        </select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input w-44" />
      </div>

      {techs.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">👷</p>
          <p className="text-gray-500 font-medium">No technicians found.</p>
          <p className="text-sm text-gray-400 mt-1">Add technicians to your Supabase <code className="bg-gray-100 px-1 rounded">technicians</code> table.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400">Loading scorecard…</p>
          </div>
        </div>
      ) : card && tech ? (
        <>
          {/* Score hero */}
          <div className={`card p-6 ${card.color === "GREEN" ? "bg-emerald-50 border-emerald-200" : card.color === "YELLOW" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-500">{monthLabel(month)}</p>
                <h2 className="text-3xl font-black text-brand-navy mt-1">{tech.name}</h2>
                <p className="text-sm text-gray-500">{tech.role}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-6xl font-black text-brand-navy">{card.overallScore}</p>
                  <p className="text-sm text-gray-500 font-medium">/ 100</p>
                </div>
                <ScoreBadge color={card.color} size="lg" />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card stat-teal px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Jobs Completed</p>
              <p className="text-2xl font-bold text-brand-teal-dk mt-1">{totalJobs}</p>
            </div>
            <div className="card stat-navy px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Revenue</p>
              <p className="text-2xl font-bold text-brand-navy mt-1">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="card stat-orange px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">MAs Sold</p>
              <p className="text-2xl font-bold text-brand-orange-dk mt-1">{totalMAS}</p>
            </div>
          </div>

          {/* KPI breakdown */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">KPI Breakdown</h3>
            <div className="divide-y divide-gray-100">
              {[...card.kpis].sort((a, b) => a.score - b.score).map((kpi) => <KPIRow key={kpi.name} kpi={kpi} />)}
            </div>
          </div>

          {/* Coaching focus */}
          {coachFocus.length > 0 && (
            <div className="card p-6 border-l-4 border-l-brand-orange bg-brand-orange-lt">
              <h3 className="font-bold text-brand-orange-dk mb-3">🎯 Coaching Focus This Month</h3>
              <div className="space-y-3">
                {coachFocus.map((kpi) => (
                  <div key={kpi.name} className="bg-white border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-800">{kpi.name}</span>
                      <ScoreBadge color={kpi.color} size="sm" />
                    </div>
                    <p className="text-sm text-gray-600">Current: <strong>{kpi.actual}</strong> vs target <strong>{kpi.target}</strong></p>
                    <p className="text-xs text-gray-400 mt-1">
                      {kpi.color === "RED" ? "Schedule weekly 1-on-1 until back above target." : "Set a specific improvement goal for next month."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly breakdown table */}
          {card.weeklyEntries.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700">Weekly Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Week","Jobs","Revenue","Avg/Job","FCC %","CB %","MAs","CSAT","Hours"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...card.weeklyEntries].sort((a, b) => b.weekOf.localeCompare(a.weekOf)).map((e) => {
                      const avg  = e.jobsCompleted > 0 ? e.totalRevenue / e.jobsCompleted : 0;
                      const fcc  = e.jobsCompleted > 0 ? ((e.firstCallCompletions / e.jobsCompleted) * 100).toFixed(0) : "—";
                      const cb   = e.jobsCompleted > 0 ? ((e.callbackJobs / e.jobsCompleted) * 100).toFixed(1) : "—";
                      const csat = e.customerRatingCount > 0 ? (e.customerRatingSum / e.customerRatingCount).toFixed(2) : "—";
                      return (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                            {new Date(e.weekOf + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </td>
                          <td className="px-4 py-3">{e.jobsCompleted}</td>
                          <td className="px-4 py-3">{formatCurrency(e.totalRevenue)}</td>
                          <td className="px-4 py-3">${avg.toFixed(0)}</td>
                          <td className="px-4 py-3">{fcc}%</td>
                          <td className="px-4 py-3">{cb}%</td>
                          <td className="px-4 py-3">{e.maintenanceAgreementsSold}</td>
                          <td className="px-4 py-3">{csat}</td>
                          <td className="px-4 py-3">{e.hoursWorked.toFixed(0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center">
              <p className="text-gray-400">No weekly data for {tech.name} in {monthLabel(month)}.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
