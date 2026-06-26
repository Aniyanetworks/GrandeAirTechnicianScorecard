"use client";

import { useEffect, useState } from "react";
import { getTechnicians, getEntries } from "@/lib/store";
import { getWeekMonday, weekLabel, formatCurrency, getScoreColor } from "@/lib/calculations";
import type { Technician, WeeklyEntry } from "@/lib/types";
import ScoreBadge from "@/components/ScoreBadge";

interface TechWeekRow { tech: Technician; entry: WeeklyEntry | null }

function metricColor(value: number, floor: number, ceiling: number, lowerIsBetter = false) {
  if (lowerIsBetter) {
    if (value <= ceiling) return "text-emerald-600 font-semibold";
    if (value >= floor)   return "text-red-600 font-semibold";
    return "text-amber-600 font-semibold";
  }
  if (value >= ceiling) return "text-emerald-600 font-semibold";
  if (value <= floor)   return "text-red-600 font-semibold";
  return "text-amber-600 font-semibold";
}

export default function WeeklyReport() {
  const [weekOf, setWeekOf]     = useState(getWeekMonday());
  const [rows, setRows]         = useState<TechWeekRow[]>([]);
  const [allWeeks, setAllWeeks] = useState<string[]>([]);

  useEffect(() => {
    const techs   = getTechnicians();
    const entries = getEntries();
    const weeks   = [...new Set(entries.map((e) => e.weekOf))].sort((a, b) => b.localeCompare(a));
    setAllWeeks(weeks);
    const current = weeks.length > 0 ? weeks[0] : getWeekMonday();
    setWeekOf((prev) => (weeks.includes(prev) ? prev : current));
    const weekEntries = entries.filter((e) => e.weekOf === (weeks.includes(weekOf) ? weekOf : current));
    setRows(techs.map((tech) => ({ tech, entry: weekEntries.find((e) => e.techId === tech.id) ?? null })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const techs   = getTechnicians();
    const entries = getEntries().filter((e) => e.weekOf === weekOf);
    setRows(techs.map((tech) => ({ tech, entry: entries.find((e) => e.techId === tech.id) ?? null })));
  }, [weekOf]);

  const active       = rows.filter((r) => r.entry !== null).map((r) => r.entry!);
  const totalJobs    = active.reduce((s, e) => s + e.jobsCompleted, 0);
  const totalRevenue = active.reduce((s, e) => s + e.totalRevenue, 0);
  const totalMAS     = active.reduce((s, e) => s + e.maintenanceAgreementsSold, 0);
  const totalFCC     = active.reduce((s, e) => s + e.firstCallCompletions, 0);
  const totalCBs     = active.reduce((s, e) => s + e.callbackJobs, 0);
  const totalLate    = active.reduce((s, e) => s + e.lateArrivals, 0);
  const totalRatSum  = active.reduce((s, e) => s + e.customerRatingSum, 0);
  const totalRatCnt  = active.reduce((s, e) => s + e.customerRatingCount, 0);

  const teamFCC    = totalJobs > 0 ? (totalFCC / totalJobs) * 100 : 0;
  const teamCB     = totalJobs > 0 ? (totalCBs / totalJobs) * 100 : 0;
  const teamOnTime = totalJobs > 0 ? ((totalJobs - totalLate) / totalJobs) * 100 : 0;
  const teamCSAT   = totalRatCnt > 0 ? totalRatSum / totalRatCnt : 0;
  const teamMARate = totalJobs > 0 ? (totalMAS / totalJobs) * 100 : 0;
  const avgRevJob  = totalJobs > 0 ? totalRevenue / totalJobs : 0;

  function shiftWeek(dir: number) {
    const d = new Date(weekOf + "T00:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeekOf(d.toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => shiftWeek(-1)} className="border border-gray-200 rounded-lg px-3 py-2 text-brand-navy hover:bg-brand-orange-lt text-sm font-bold">‹</button>
        <select value={weekOf} onChange={(e) => setWeekOf(e.target.value)} className="input w-60">
          {allWeeks.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
          {!allWeeks.includes(weekOf) && <option value={weekOf}>{weekLabel(weekOf)}</option>}
        </select>
        <button onClick={() => shiftWeek(1)} className="border border-gray-200 rounded-lg px-3 py-2 text-brand-navy hover:bg-brand-orange-lt text-sm font-bold">›</button>
      </div>

      {active.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-gray-500">No data for this week. Select a different week.</p>
        </div>
      ) : (
        <>
          {/* Team summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Jobs",    value: totalJobs,                   sub: `${active.length} techs active`, accent: "stat-teal"  },
              { label: "Team Revenue",  value: formatCurrency(totalRevenue), sub: `${formatCurrency(avgRevJob)}/job`, accent: "stat-navy" },
              { label: "First-Call %",  value: `${teamFCC.toFixed(0)}%`,    sub: "target 95%",  accent: teamFCC >= 92 ? "stat-teal" : teamFCC >= 80 ? "border-l-4 border-l-amber-400 bg-amber-50" : "border-l-4 border-l-red-400 bg-red-50" },
              { label: "Callback Rate", value: `${teamCB.toFixed(1)}%`,     sub: "target < 3%", accent: teamCB <= 3 ? "stat-teal" : teamCB <= 6 ? "border-l-4 border-l-amber-400 bg-amber-50" : "border-l-4 border-l-red-400 bg-red-50" },
              { label: "MA Rate",       value: `${teamMARate.toFixed(0)}%`, sub: "target 25%",  accent: "stat-orange" },
              { label: "Team CSAT",     value: teamCSAT > 0 ? teamCSAT.toFixed(2) : "—", sub: "target 4.8", accent: "stat-teal" },
            ].map((s) => (
              <div key={s.label} className={`card ${s.accent} px-4 py-3`}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">{s.label}</p>
                <p className="text-xl font-black text-brand-navy mt-1">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Per-tech cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rows.map(({ tech, entry }) => {
              if (!entry) return (
                <div key={tech.id} className="card border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center text-center min-h-[180px]">
                  <p className="font-bold text-gray-400">{tech.name}</p>
                  <p className="text-xs text-gray-300 mt-1">No entry this week</p>
                </div>
              );

              const fccPct    = entry.jobsCompleted > 0 ? (entry.firstCallCompletions / entry.jobsCompleted) * 100 : 0;
              const cbPct     = entry.jobsCompleted > 0 ? (entry.callbackJobs / entry.jobsCompleted) * 100 : 0;
              const onTimePct = entry.jobsCompleted > 0 ? ((entry.jobsCompleted - entry.lateArrivals) / entry.jobsCompleted) * 100 : 100;
              const maPct     = entry.jobsCompleted > 0 ? (entry.maintenanceAgreementsSold / entry.jobsCompleted) * 100 : 0;
              const csat      = entry.customerRatingCount > 0 ? entry.customerRatingSum / entry.customerRatingCount : 0;
              const avgRev    = entry.jobsCompleted > 0 ? entry.totalRevenue / entry.jobsCompleted : 0;
              const quickScore = ((fccPct >= 92 ? 100 : fccPct >= 80 ? 75 : 50) + (cbPct <= 3 ? 100 : cbPct <= 6 ? 75 : 40) + (avgRev >= 450 ? 100 : avgRev >= 350 ? 75 : 50)) / 3;
              const weekColor = getScoreColor(quickScore);

              return (
                <div key={tech.id} className={`card border-2 p-5 space-y-3 ${weekColor === "GREEN" ? "border-emerald-200 bg-emerald-50" : weekColor === "YELLOW" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-brand-navy leading-tight">{tech.name}</p>
                      <p className="text-xs text-gray-500">{tech.role}</p>
                    </div>
                    <ScoreBadge color={weekColor} size="sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div><p className="text-xs text-gray-400">Jobs</p><p className="font-bold text-brand-navy">{entry.jobsCompleted}</p></div>
                    <div><p className="text-xs text-gray-400">Revenue</p><p className="font-bold text-brand-navy">{formatCurrency(entry.totalRevenue)}</p></div>
                    <div><p className="text-xs text-gray-400">Avg / Job</p><p className={metricColor(avgRev, 350, 450)}>{formatCurrency(avgRev)}</p></div>
                    <div><p className="text-xs text-gray-400">MAs Sold</p><p className={metricColor(maPct, 5, 20)}>{entry.maintenanceAgreementsSold} <span className="text-gray-400 font-normal text-xs">({maPct.toFixed(0)}%)</span></p></div>
                    <div><p className="text-xs text-gray-400">1st-Call %</p><p className={metricColor(fccPct, 80, 92)}>{fccPct.toFixed(0)}%</p></div>
                    <div><p className="text-xs text-gray-400">Callbacks</p><p className={metricColor(cbPct, 0, 6, true)}>{cbPct.toFixed(1)}%</p></div>
                    <div><p className="text-xs text-gray-400">On-Time</p><p className={metricColor(onTimePct, 85, 95)}>{onTimePct.toFixed(0)}%</p></div>
                    <div><p className="text-xs text-gray-400">CSAT</p><p className={csat > 0 ? metricColor(csat, 4.3, 4.7) : "text-gray-400"}>{csat > 0 ? csat.toFixed(2) : "—"}</p></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full team table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-brand-navy">Full Team Breakdown — {weekLabel(weekOf)}</h3>
              <span className="text-xs text-gray-400">{active.length} of {rows.length} techs active</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Technician","Jobs","Revenue","Avg/Job","FCC %","CB %","MA %","On-Time","CSAT","Hours"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(({ tech, entry }) => {
                    if (!entry) return (
                      <tr key={tech.id} className="opacity-40">
                        <td className="px-4 py-3 font-medium text-gray-500">{tech.name}</td>
                        {Array(9).fill(null).map((_, i) => <td key={i} className="px-4 py-3 text-gray-300">—</td>)}
                      </tr>
                    );
                    const avgRev    = entry.jobsCompleted > 0 ? entry.totalRevenue / entry.jobsCompleted : 0;
                    const fccPct    = entry.jobsCompleted > 0 ? (entry.firstCallCompletions / entry.jobsCompleted) * 100 : 0;
                    const cbPct     = entry.jobsCompleted > 0 ? (entry.callbackJobs / entry.jobsCompleted) * 100 : 0;
                    const maPct     = entry.jobsCompleted > 0 ? (entry.maintenanceAgreementsSold / entry.jobsCompleted) * 100 : 0;
                    const onTimePct = entry.jobsCompleted > 0 ? ((entry.jobsCompleted - entry.lateArrivals) / entry.jobsCompleted) * 100 : 100;
                    const csat      = entry.customerRatingCount > 0 ? entry.customerRatingSum / entry.customerRatingCount : 0;
                    return (
                      <tr key={tech.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-brand-navy">{tech.name}</td>
                        <td className="px-4 py-3 text-gray-700">{entry.jobsCompleted}</td>
                        <td className="px-4 py-3 text-gray-700">{formatCurrency(entry.totalRevenue)}</td>
                        <td className={`px-4 py-3 ${metricColor(avgRev, 350, 450)}`}>{formatCurrency(avgRev)}</td>
                        <td className={`px-4 py-3 ${metricColor(fccPct, 80, 92)}`}>{fccPct.toFixed(0)}%</td>
                        <td className={`px-4 py-3 ${metricColor(cbPct, 0, 6, true)}`}>{cbPct.toFixed(1)}%</td>
                        <td className={`px-4 py-3 ${metricColor(maPct, 5, 20)}`}>{maPct.toFixed(0)}%</td>
                        <td className={`px-4 py-3 ${metricColor(onTimePct, 85, 95)}`}>{onTimePct.toFixed(0)}%</td>
                        <td className={`px-4 py-3 ${csat > 0 ? metricColor(csat, 4.3, 4.7) : "text-gray-400"}`}>{csat > 0 ? csat.toFixed(2) : "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.hoursWorked.toFixed(0)}h</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-brand-navy-xs border-t-2 border-brand-navy/20 font-semibold">
                    <td className="px-4 py-3 text-brand-navy font-bold">Team Total</td>
                    <td className="px-4 py-3 text-brand-navy">{totalJobs}</td>
                    <td className="px-4 py-3 text-brand-navy">{formatCurrency(totalRevenue)}</td>
                    <td className={`px-4 py-3 ${metricColor(avgRevJob, 350, 450)}`}>{formatCurrency(avgRevJob)}</td>
                    <td className={`px-4 py-3 ${metricColor(teamFCC, 80, 92)}`}>{teamFCC.toFixed(0)}%</td>
                    <td className={`px-4 py-3 ${metricColor(teamCB, 0, 6, true)}`}>{teamCB.toFixed(1)}%</td>
                    <td className={`px-4 py-3 ${metricColor(teamMARate, 5, 20)}`}>{teamMARate.toFixed(0)}%</td>
                    <td className={`px-4 py-3 ${metricColor(teamOnTime, 85, 95)}`}>{teamOnTime.toFixed(0)}%</td>
                    <td className={`px-4 py-3 ${teamCSAT > 0 ? metricColor(teamCSAT, 4.3, 4.7) : "text-gray-400"}`}>{teamCSAT > 0 ? teamCSAT.toFixed(2) : "—"}</td>
                    <td className="px-4 py-3 text-brand-navy">{active.reduce((s, e) => s + e.hoursWorked, 0).toFixed(0)}h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Color key */}
          <div className="card px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Metric Color Key</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-emerald-700 font-semibold">Green</span> = At or above target</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-amber-700 font-semibold">Amber</span> = Below target, needs attention</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="text-red-700 font-semibold">Red</span> = Significantly below target</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
