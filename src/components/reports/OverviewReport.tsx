"use client";

import { useEffect, useState } from "react";
import { getTechnicians, getEntriesForMonth } from "@/lib/store";
import { buildMonthlyScorecard, getCurrentMonth, monthLabel, formatCurrency } from "@/lib/calculations";
import type { MonthlyScorecard, Technician } from "@/lib/types";
import ScoreBadge from "@/components/ScoreBadge";
import KPIRow from "@/components/KPIRow";
import Link from "next/link";

export default function OverviewReport() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [cards, setCards] = useState<{ tech: Technician; card: MonthlyScorecard }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const techs = getTechnicians();
    const results = techs.map((tech) => {
      const entries = getEntriesForMonth(month).filter((e) => e.techId === tech.id);
      return { tech, card: buildMonthlyScorecard(tech.id, month, entries) };
    });
    setCards(results);
    setSelected(null);
  }, [month]);

  const green  = cards.filter((c) => c.card.color === "GREEN").length;
  const yellow = cards.filter((c) => c.card.color === "YELLOW").length;
  const red    = cards.filter((c) => c.card.color === "RED").length;
  const avgScore = cards.length
    ? Math.round(cards.reduce((s, c) => s + c.card.overallScore, 0) / cards.length)
    : 0;
  const totalRevenue = cards.reduce(
    (s, c) => s + c.card.weeklyEntries.reduce((r, e) => r + e.totalRevenue, 0), 0
  );

  const selectedCard = cards.find((c) => c.tech.id === selected);

  const cardBg: Record<string, string> = {
    GREEN:  "border-emerald-300 bg-emerald-50 hover:border-emerald-400",
    YELLOW: "border-amber-300 bg-amber-50 hover:border-amber-400",
    RED:    "border-red-300 bg-red-50 hover:border-red-400",
  };
  const ringColor: Record<string, string> = {
    GREEN:  "ring-emerald-400",
    YELLOW: "ring-amber-400",
    RED:    "ring-red-400",
  };

  function scoreGauge(score: number) {
    const color = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";
    const r = 30, circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ * 0.75;
    return (
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-[135deg]">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash + circ * 0.25}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold text-brand-teal">{monthLabel(month)}</span>
        </p>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input w-44" />
      </div>

      {/* KPI summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card stat-teal px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Team Avg Score</p>
          <p className="text-2xl font-black text-brand-teal-dk mt-1">{avgScore}<span className="text-sm font-normal text-gray-400"> / 100</span></p>
        </div>
        <div className="card stat-navy px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Month Revenue</p>
          <p className="text-2xl font-black text-brand-navy mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card border-l-4 border-l-emerald-500 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Green Techs</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{green}<span className="text-sm font-normal text-gray-400"> / {cards.length}</span></p>
        </div>
        <div className="card border-l-4 border-l-red-500 bg-red-50 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Need Coaching</p>
          <p className="text-2xl font-black text-red-700 mt-1">{yellow + red}<span className="text-sm font-normal text-gray-400"> techs</span></p>
        </div>
      </div>

      {/* Tech cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ tech, card }) => (
          <button
            key={tech.id}
            onClick={() => setSelected(selected === tech.id ? null : tech.id)}
            className={`card border-2 p-5 text-left transition-all hover:shadow-md ${cardBg[card.color]} ${selected === tech.id ? `ring-2 ${ringColor[card.color]}` : ""}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-brand-navy text-base leading-tight">{tech.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tech.role}</p>
              </div>
              <ScoreBadge color={card.color} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <div className="relative">
                {scoreGauge(card.overallScore)}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-brand-navy">{card.overallScore}</span>
                </div>
              </div>
              <div className="text-right space-y-1">
                {card.kpis.slice(0, 3).map((k) => (
                  <div key={k.name} className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs text-gray-500 truncate max-w-[80px]">{k.name.split(" ")[0]}</span>
                    <span className={`text-xs font-semibold ${k.color === "GREEN" ? "text-emerald-600" : k.color === "YELLOW" ? "text-amber-600" : "text-red-600"}`}>{k.actual}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              card.color === "GREEN"  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : card.color === "YELLOW" ? "bg-amber-100 text-amber-700 border border-amber-200"
            :                           "bg-red-100 text-red-700 border border-red-200"}`}>
              {card.color === "GREEN" && "✓ Exceeding expectations"}
              {card.color === "YELLOW" && "↗ Needs improvement"}
              {card.color === "RED" && "⚠ Coaching required"}
            </div>
          </button>
        ))}
      </div>

      {/* KPI drill-down */}
      {selectedCard && (
        <div className="card p-6 space-y-4 border-t-4 border-t-brand-teal">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-brand-navy">{selectedCard.tech.name} — KPI Breakdown</h2>
              <p className="text-sm text-gray-500">{monthLabel(month)}</p>
            </div>
            <div className="flex items-center gap-3">
              <ScoreBadge color={selectedCard.card.color} score={selectedCard.card.overallScore} size="lg" />
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {selectedCard.card.kpis.map((kpi) => <KPIRow key={kpi.name} kpi={kpi} />)}
          </div>
          <div className="flex gap-3 pt-2">
            <Link href={`/monthly?tech=${selectedCard.tech.id}&month=${month}`} className="btn-primary text-sm">Full Monthly Scorecard</Link>
            <Link href="/weekly" className="btn-teal text-sm">Weekly Report</Link>
          </div>
        </div>
      )}

      {/* Score band legend */}
      <div className="card px-6 py-4 border-t-4 border-t-brand-orange">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Score Bands</p>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /><span className="font-semibold text-emerald-700">GREEN 85–100</span><span className="text-gray-500">Exceeding — Reward &amp; reinforce</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500" /><span className="font-semibold text-amber-700">YELLOW 70–84</span><span className="text-gray-500">Needs improvement — Targeted coaching</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /><span className="font-semibold text-red-700">RED 0–69</span><span className="text-gray-500">Immediate coaching — Weekly check-ins</span></div>
        </div>
      </div>
    </div>
  );
}
