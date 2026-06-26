"use client";

import { useEffect, useState } from "react";
import { getTechnicians, getEntriesForTechMonth } from "@/lib/store";
import { buildMonthlyScorecard, getScoreColor, monthLabel, formatCurrency } from "@/lib/calculations";
import type { Technician } from "@/lib/types";
import ScoreBadge from "@/components/ScoreBadge";
import KPIRow from "@/components/KPIRow";

type QuarterKey = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTERS: Record<QuarterKey, number[]> = { Q1:[1,2,3], Q2:[4,5,6], Q3:[7,8,9], Q4:[10,11,12] };

function getCurrentQuarter(): { year: number; q: QuarterKey } {
  const m = new Date().getMonth() + 1;
  const q = m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
  return { year: new Date().getFullYear(), q: q as QuarterKey };
}

interface MonthRow { month: string; label: string; score: number; revenue: number; jobs: number; color: "GREEN"|"YELLOW"|"RED" }

export default function QuarterlyReport() {
  const [techs, setTechs]       = useState<Technician[]>([]);
  const [techId, setTechId]     = useState("");
  const [year, setYear]         = useState(() => getCurrentQuarter().year);
  const [q, setQ]               = useState<QuarterKey>(() => getCurrentQuarter().q);
  const [rows, setRows]         = useState<MonthRow[]>([]);
  const [selected, setSelected] = useState<MonthRow | null>(null);
  const [drillKpis, setDrillKpis] = useState<ReturnType<typeof buildMonthlyScorecard>["kpis"]>([]);

  useEffect(() => {
    const t = getTechnicians();
    setTechs(t);
    setTechId(t[0]?.id || "");
  }, []);

  useEffect(() => {
    if (!techId) return;
    const months = QUARTERS[q].map((m) => `${year}-${String(m).padStart(2, "0")}`);
    setRows(months.map((month) => {
      const entries = getEntriesForTechMonth(techId, month);
      const card = buildMonthlyScorecard(techId, month, entries);
      return { month, label: monthLabel(month), score: card.overallScore, revenue: entries.reduce((s, e) => s + e.totalRevenue, 0), jobs: entries.reduce((s, e) => s + e.jobsCompleted, 0), color: card.color };
    }));
    setSelected(null);
  }, [techId, year, q]);

  useEffect(() => {
    if (!selected || !techId) return;
    const entries = getEntriesForTechMonth(techId, selected.month);
    setDrillKpis(buildMonthlyScorecard(techId, selected.month, entries).kpis);
  }, [selected, techId]);

  const validRows  = rows.filter((r) => r.jobs > 0);
  const avgScore   = validRows.length ? Math.round(validRows.reduce((s, r) => s + r.score, 0) / validRows.length) : 0;
  const totalRev   = rows.reduce((s, r) => s + r.revenue, 0);
  const totalJobs  = rows.reduce((s, r) => s + r.jobs, 0);
  const qColor     = validRows.length ? getScoreColor(avgScore) : "YELLOW";
  const tech       = techs.find((t) => t.id === techId);
  const barColors: Record<string, string> = { GREEN:"bg-emerald-500", YELLOW:"bg-amber-500", RED:"bg-red-500" };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={techId} onChange={(e) => setTechId(e.target.value)} className="input w-52">
          {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="input w-28">
          {[2024,2025,2026,2027].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select value={q} onChange={(e) => setQ(e.target.value as QuarterKey)} className="input w-24">
          {(["Q1","Q2","Q3","Q4"] as QuarterKey[]).map((qq) => <option key={qq}>{qq}</option>)}
        </select>
      </div>

      {tech && (
        <>
          {/* Hero */}
          <div className={`card p-6 ${qColor === "GREEN" ? "bg-emerald-50 border-emerald-200" : qColor === "YELLOW" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-semibold">{year} {q}</p>
                <h2 className="text-3xl font-black text-brand-navy mt-1">{tech.name}</h2>
                <p className="text-sm text-gray-500">{tech.role}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-6xl font-black text-brand-navy">{validRows.length > 0 ? avgScore : "—"}</p>
                  <p className="text-sm text-gray-500">Quarterly Avg</p>
                </div>
                {validRows.length > 0 && <ScoreBadge color={qColor} size="lg" />}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card stat-teal px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Total Jobs</p>
              <p className="text-2xl font-bold text-brand-teal-dk mt-1">{totalJobs}</p>
            </div>
            <div className="card stat-navy px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Total Revenue</p>
              <p className="text-2xl font-bold text-brand-navy mt-1">{formatCurrency(totalRev)}</p>
            </div>
            <div className="card stat-orange px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Months Scored</p>
              <p className="text-2xl font-bold text-brand-orange-dk mt-1">{validRows.length} / 3</p>
            </div>
          </div>

          {/* Month bars */}
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Month-by-Month Scores</h3>
            <p className="text-xs text-gray-400">Click a month to see its KPI breakdown below.</p>
            <div className="space-y-4">
              {rows.map((row) => (
                <button key={row.month} onClick={() => setSelected(selected?.month === row.month ? null : row)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all hover:shadow-sm ${selected?.month === row.month ? "border-brand-teal bg-brand-teal-lt" : "border-gray-100 hover:border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-brand-navy">{row.label}</span>
                    <div className="flex items-center gap-3">
                      {row.jobs > 0 ? <ScoreBadge color={row.color} score={row.score} size="sm" /> : <span className="text-xs text-gray-400">No data</span>}
                      <span className="text-xs text-gray-400">{row.jobs} jobs · {formatCurrency(row.revenue)}</span>
                    </div>
                  </div>
                  {row.jobs > 0 && (
                    <div className="bg-gray-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all duration-500 ${barColors[row.color]}`} style={{ width: `${row.score}%` }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* KPI drill-down */}
          {selected && drillKpis.length > 0 && (
            <div className="card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-brand-navy">KPI Detail — {selected.label}</h3>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="divide-y divide-gray-100">
                {[...drillKpis].sort((a, b) => a.score - b.score).map((kpi) => <KPIRow key={kpi.name} kpi={kpi} />)}
              </div>
            </div>
          )}

          {/* Pay recommendation */}
          {validRows.length > 0 && (
            <div className="card p-6 border-l-4 border-l-brand-teal bg-brand-teal-lt">
              <h3 className="font-bold text-brand-teal-dk mb-2">Pay &amp; Review Recommendation</h3>
              <div className="text-sm text-brand-navy space-y-1">
                {qColor === "GREEN" && (<><p>✅ <strong>Eligible for raise / bonus.</strong> Consistently exceeding expectations.</p><p>Consider for lead technician role or increased commission structure.</p></>)}
                {qColor === "YELLOW" && (<><p>⚠️ <strong>Hold on raise.</strong> Needs to sustain GREEN for 2 consecutive quarters.</p><p>Set specific targets for the bottom 1–2 KPIs and review next quarter.</p></>)}
                {qColor === "RED" && (<><p>🚨 <strong>Performance improvement plan required.</strong></p><p>Weekly check-ins, set 30/60/90-day improvement milestones.</p></>)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
