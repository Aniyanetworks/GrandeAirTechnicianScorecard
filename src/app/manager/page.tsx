"use client";

import { useEffect, useState } from "react";
import { getTechnicians, getEntriesForMonth } from "@/lib/store";
import { buildMonthlyScorecard, getCurrentMonth, monthLabel, formatCurrency, getScoreColor } from "@/lib/calculations";
import type { KPIScore } from "@/lib/types";
import ScoreBadge from "@/components/ScoreBadge";
import KPIRow from "@/components/KPIRow";

interface MgrKPI extends KPIScore { weight: number }

function ts(v: number, floor: number, ceil: number, lower = false): number {
  if (lower) { if (v <= ceil) return 100; if (v >= floor) return 0; return Math.max(0, Math.min(100, 100 - ((v - ceil) / (floor - ceil)) * 100)); }
  if (v >= ceil) return 100; if (v <= floor) return 0; return Math.max(0, Math.min(100, ((v - floor) / (ceil - floor)) * 100));
}

export default function ManagerPage() {
  const [month, setMonth]               = useState(getCurrentMonth());
  const [coachingSessions, setCoaching] = useState("0");
  const [teamRevTarget, setRevTarget]   = useState("20000");
  const [mgrKPIs, setMgrKPIs]           = useState<MgrKPI[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [teamStats, setTeamStats]       = useState({
    green: 0, yellow: 0, red: 0, avgScore: 0,
    teamRevenue: 0, teamJobs: 0, teamFCC: 0,
    teamMAS: 0, teamCSAT: 0, teamCallbacks: 0,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [techs, entries] = await Promise.all([
          getTechnicians(),
          getEntriesForMonth(month),
        ]);

        const cards = techs.map((t) => {
          const te = entries.filter((e) => e.techId === t.id);
          return { tech: t, card: buildMonthlyScorecard(t.id, month, te), entries: te };
        });

        const green   = cards.filter((c) => c.card.color === "GREEN").length;
        const yellow  = cards.filter((c) => c.card.color === "YELLOW").length;
        const red     = cards.filter((c) => c.card.color === "RED").length;
        const avgScore = cards.length
          ? Math.round(cards.reduce((s, c) => s + c.card.overallScore, 0) / cards.length)
          : 0;

        const allEntries    = cards.flatMap((c) => c.entries);
        const teamRevenue   = allEntries.reduce((s, e) => s + e.totalRevenue, 0);
        const teamJobs      = allEntries.reduce((s, e) => s + e.jobsCompleted, 0);
        const teamFCCCount  = allEntries.reduce((s, e) => s + e.firstCallCompletions, 0);
        const teamMAS       = allEntries.reduce((s, e) => s + e.maintenanceAgreementsSold, 0);
        const teamCBs       = allEntries.reduce((s, e) => s + e.callbackJobs, 0);
        const teamRatingSum = allEntries.reduce((s, e) => s + e.customerRatingSum, 0);
        const teamRatingCnt = allEntries.reduce((s, e) => s + e.customerRatingCount, 0);

        const teamFCC  = teamJobs > 0 ? (teamFCCCount / teamJobs) * 100 : 0;
        const teamMASr = teamJobs > 0 ? (teamMAS / teamJobs) * 100 : 0;
        const teamCSAT = teamRatingCnt > 0 ? teamRatingSum / teamRatingCnt : 0;
        const teamCBr  = teamJobs > 0 ? (teamCBs / teamJobs) * 100 : 0;

        setTeamStats({ green, yellow, red, avgScore, teamRevenue, teamJobs, teamFCC, teamMAS: teamMASr, teamCSAT, teamCallbacks: teamCBr });

        const revTarget = Number(teamRevTarget) || 1;
        const revPct    = Math.min(100, (teamRevenue / revTarget) * 100);
        const coaching  = Number(coachingSessions);

        const kpis: MgrKPI[] = [
          { name: "Team Revenue vs Goal",       value: revPct,    score: ts(revPct, 70, 100),      weight: 25, color: getScoreColor(ts(revPct, 70, 100)),      target: "100%", actual: `${revPct.toFixed(0)}%` },
          { name: "Team Avg Score",             value: avgScore,  score: ts(avgScore, 60, 90),      weight: 20, color: getScoreColor(ts(avgScore, 60, 90)),      target: "85+",  actual: String(avgScore) },
          { name: "Team First-Call Completion", value: teamFCC,   score: ts(teamFCC, 70, 95),       weight: 15, color: getScoreColor(ts(teamFCC, 70, 95)),       target: "95%",  actual: `${teamFCC.toFixed(1)}%` },
          { name: "Team CSAT",                  value: teamCSAT,  score: ts(teamCSAT, 3.5, 5.0),    weight: 15, color: getScoreColor(ts(teamCSAT, 3.5, 5.0)),    target: "4.8",  actual: teamCSAT > 0 ? teamCSAT.toFixed(2) : "N/A" },
          { name: "Team MA Rate",               value: teamMASr,  score: ts(teamMASr, 5, 25),       weight: 10, color: getScoreColor(ts(teamMASr, 5, 25)),       target: "20%",  actual: `${teamMASr.toFixed(1)}%` },
          { name: "Team Callback Rate",         value: teamCBr,   score: ts(teamCBr, 0, 8, true),   weight: 10, color: getScoreColor(ts(teamCBr, 0, 8, true)),   target: "< 3%", actual: `${teamCBr.toFixed(1)}%` },
          { name: "Coaching Sessions",          value: coaching,  score: red === 0 ? 100 : ts(coaching, 0, Math.max(red, 1) * 2), weight: 5, color: getScoreColor(red === 0 ? 100 : ts(coaching, 0, red * 2)), target: `${Math.max(red, 1) * 2}+`, actual: String(coaching) },
        ];

        const total    = kpis.reduce((s, k) => s + k.weight, 0);
        const weighted = kpis.reduce((s, k) => s + k.score * k.weight, 0);
        setMgrKPIs(kpis);
        setOverallScore(Math.round(weighted / total));
      } catch (err) {
        console.error("Failed to load manager data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month, coachingSessions, teamRevTarget]);

  const scoreColor = getScoreColor(overallScore);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-navy">Service Manager Scorecard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manager is scored on team-level results</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input w-44" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400">Loading manager scorecard…</p>
          </div>
        </div>
      ) : (
        <>
          {/* Manager score hero */}
          <div className={`card p-6 ${scoreColor === "GREEN" ? "bg-emerald-50 border-emerald-200" : scoreColor === "YELLOW" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-semibold">{monthLabel(month)}</p>
                <h2 className="text-3xl font-black text-gray-900 mt-1">Service Manager</h2>
                <p className="text-sm text-gray-500">Scored on team-level outcomes</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-6xl font-black text-brand-navy">{overallScore}</p>
                  <p className="text-sm text-gray-500">/ 100</p>
                </div>
                <ScoreBadge color={scoreColor} size="lg" />
              </div>
            </div>
          </div>

          {/* Inputs */}
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Manager Inputs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Monthly Team Revenue Goal ($)</label>
                <input type="number" value={teamRevTarget} onChange={(e) => setRevTarget(e.target.value)} className="input bg-amber-50" placeholder="20000" />
                <p className="text-xs text-gray-400 mt-1">From business plan / budgeted target</p>
              </div>
              <div>
                <label className="label">Coaching Sessions Held</label>
                <input type="number" min="0" value={coachingSessions} onChange={(e) => setCoaching(e.target.value)} className="input bg-amber-50" placeholder="0" />
                <p className="text-xs text-gray-400 mt-1">1-on-1s with RED/YELLOW techs this month</p>
              </div>
            </div>
          </div>

          {/* Team snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card stat-navy px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Team Revenue</p>
              <p className="text-xl font-bold text-brand-navy mt-1">{formatCurrency(teamStats.teamRevenue)}</p>
            </div>
            <div className="card px-5 py-4 border-l-4 border-l-emerald-500 bg-emerald-50">
              <p className="text-xs font-semibold text-gray-500 uppercase">🟢 Green Techs</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">{teamStats.green}</p>
            </div>
            <div className="card px-5 py-4 border-l-4 border-l-amber-500 bg-amber-50">
              <p className="text-xs font-semibold text-gray-500 uppercase">🟡 Yellow Techs</p>
              <p className="text-xl font-bold text-amber-700 mt-1">{teamStats.yellow}</p>
            </div>
            <div className="card px-5 py-4 border-l-4 border-l-red-500 bg-red-50">
              <p className="text-xs font-semibold text-gray-500 uppercase">🔴 Red Techs</p>
              <p className="text-xl font-bold text-red-700 mt-1">{teamStats.red}</p>
            </div>
          </div>

          {/* Manager KPIs */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">Manager KPI Breakdown</h3>
            <div className="divide-y divide-gray-100">
              {mgrKPIs.map((kpi) => <KPIRow key={kpi.name} kpi={kpi} />)}
            </div>
          </div>

          {/* Weekly routine reminder */}
          <div className="card p-6 border-l-4 border-l-brand-orange bg-brand-orange-lt">
            <h3 className="font-bold text-brand-navy mb-3">📋 Weekly Manager Routine</h3>
            <div className="space-y-2 text-sm text-brand-navy-lt">
              <div className="flex gap-3"><span className="font-bold w-20 flex-shrink-0">Mon AM</span><span>Pull last week&apos;s numbers from Housecall Pro → enter in Weekly Data Entry tab.</span></div>
              <div className="flex gap-3"><span className="font-bold w-20 flex-shrink-0">Mon AM</span><span>Open Dashboard. Anyone RED gets a 10-min coaching huddle that same day.</span></div>
              <div className="flex gap-3"><span className="font-bold w-20 flex-shrink-0">Month End</span><span>Review Monthly Scorecard with each tech (15 min each).</span></div>
              <div className="flex gap-3"><span className="font-bold w-20 flex-shrink-0">Qtr End</span><span>Review Quarterly Scorecard — ties to pay, bonuses, offer letters.</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
