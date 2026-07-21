"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type KpiFormat = "currency" | "number" | "percent" | "decimal";
type Status    = "GREEN" | "YELLOW" | "RED";

interface KpiDef {
  id:             string;
  category:       string;
  label:          string;
  target:         number;
  min:            number;
  worldClass:     number;
  weight:         number;
  format:         KpiFormat;
  lowerIsBetter?: boolean;
  noData?:        boolean;
}

// ── KPI Definitions (from scorecard spec) ─────────────────────────────────────

const KPI_DEFS: KpiDef[] = [
  { id: "total_revenue",  category: "REVENUE",     label: "Total Revenue",            target: 50000, min: 35000, worldClass: 70000, weight: 18, format: "currency" },
  { id: "avg_ticket",     category: "REVENUE",     label: "Average Ticket",           target: 650,   min: 450,   worldClass: 900,   weight: 7,  format: "currency" },
  { id: "rev_per_call",   category: "REVENUE",     label: "Revenue Per Service Call", target: 550,   min: 400,   worldClass: 800,   weight: 5,  format: "currency" },
  { id: "est_created",    category: "SALES",       label: "Estimates Created",        target: 20,    min: 12,    worldClass: 30,    weight: 4,  format: "number" },
  { id: "est_sold",       category: "SALES",       label: "Estimates Sold",           target: 10,    min: 6,     worldClass: 18,    weight: 6,  format: "number" },
  { id: "est_close_rate", category: "SALES",       label: "Estimate Close Rate",      target: 0.50,  min: 0.35,  worldClass: 0.65,  weight: 8,  format: "percent" },
  { id: "memberships",    category: "MEMBERSHIPS", label: "Memberships Sold",         target: 10,    min: 5,     worldClass: 20,    weight: 12, format: "number",  noData: true },
  { id: "reviews_gen",    category: "CX",          label: "Reviews Generated",        target: 8,     min: 4,     worldClass: 15,    weight: 8,  format: "number",  noData: true },
  { id: "avg_rating",     category: "CX",          label: "Average Review Rating",    target: 4.8,   min: 4.5,   worldClass: 5.0,   weight: 5,  format: "decimal", noData: true },
  { id: "callback_rate",  category: "QUALITY",     label: "Callback Rate",            target: 0.03,  min: 0.06,  worldClass: 0.01,  weight: 15, format: "percent", lowerIsBetter: true, noData: true },
  { id: "service_calls",  category: "OPERATIONS",  label: "Service Calls Run",        target: 90,    min: 65,    worldClass: 120,   weight: 5,  format: "number" },
  { id: "jobs_completed", category: "OPERATIONS",  label: "Jobs Completed",           target: 75,    min: 55,    worldClass: 100,   weight: 7,  format: "number" },
];

// Weight sum of calculable KPIs (18+7+5+4+6+8+5+7 = 60)
const AVAIL_WEIGHT = KPI_DEFS.filter(k => !k.noData).reduce((s, k) => s + k.weight, 0);

// ── Scoring ───────────────────────────────────────────────────────────────────
// Verified against CSV: below-min uses 0–50, min–target uses 50–100, target–worldClass uses 100–120

function calcRawScore(actual: number, def: KpiDef): number {
  const { min, target, worldClass, lowerIsBetter } = def;
  if (lowerIsBetter) {
    if (actual <= worldClass) return 120;
    if (actual <= target)     return 100 + ((target - actual) / (target - worldClass)) * 20;
    if (actual <= min)        return 50  + ((min - actual)    / (min - target))        * 50;
    return Math.max(0, (min / actual) * 50);
  }
  if (actual >= worldClass) return 120;
  if (actual >= target)     return 100 + ((actual - target) / (worldClass - target)) * 20;
  if (actual >= min)        return 50  + ((actual - min)    / (target - min))        * 50;
  return Math.max(0, (actual / min) * 50);
}

function getStatus(actual: number, def: KpiDef): Status {
  const { min, target, lowerIsBetter } = def;
  if (lowerIsBetter) {
    if (actual <= target) return "GREEN";
    if (actual <= min)    return "YELLOW";
    return "RED";
  }
  if (actual >= target) return "GREEN";
  if (actual >= min)    return "YELLOW";
  return "RED";
}

// ── Formatters ────────────────────────────────────────────────────────────────

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

function fmtVal(v: number, fmt: KpiFormat): string {
  if (fmt === "currency") return CURRENCY.format(v);
  if (fmt === "percent")  return `${(v * 100).toFixed(1)}%`;
  if (fmt === "decimal")  return v.toFixed(1);
  return v.toLocaleString("en-US");
}

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMonth(k: string) {
  const [yr, mo] = k.split("-");
  return `${MON[parseInt(mo, 10) - 1]} ${yr}`;
}

// ── Status values from HousecallPro ──────────────────────────────────────────

const COMPLETED_STATUSES = new Set(["complete unrated","complete","completed","done","finished","closed","unrated"]);
const SOLD_STATUSES      = new Set(["approved","won","accepted","sold","closed","converted"]);

// ── Supabase types ────────────────────────────────────────────────────────────

interface Job {
  id: string;
  subtotal:           number | null;
  appointment_status: string | null;
  created_at:         string;
  user_name:          string | null;
  user_id:            string | null;
}

interface Estimate {
  id: string;
  total_amount:    number | null;
  estimate_status: string | null;
  created_at:      string;
  user_name:       string | null;
  user_id:         string | null;
}

interface Tech { id: string; name: string; }

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<Status, { badge: string; dot: string; row: string }> = {
  GREEN:  { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", row: "" },
  YELLOW: { badge: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-400",  row: "bg-amber-50/40" },
  RED:    { badge: "bg-red-100 text-red-600 border-red-200",             dot: "bg-red-500",    row: "bg-red-50/30" },
};

const CAT_COLOR: Record<string, string> = {
  REVENUE:     "#1e3a5f",
  SALES:       "#0d9488",
  MEMBERSHIPS: "#7c3aed",
  CX:          "#ea580c",
  QUALITY:     "#0891b2",
  OPERATIONS:  "#475569",
};

// ── KPI row result ────────────────────────────────────────────────────────────

interface KpiRow {
  def:      KpiDef;
  actual:   number | null;
  rawScore: number | null;
  wtdScore: number | null;
  status:   Status | null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScorecardPage() {
  const [jobs,      setJobs]      = useState<Job[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [selectedTech, setTech]   = useState("all");
  const [selectedMonth, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [jr, er] = await Promise.all([
        supabase
          .from("appointments")
          .select("id,subtotal,appointment_status,created_at,user_name,user_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("estimates")
          .select("id,total_amount,estimate_status,created_at,user_name,user_id")
          .order("created_at", { ascending: false }),
      ]);
      if (jr.error) throw new Error(jr.error.message);
      if (er.error) throw new Error(er.error.message);
      setJobs((jr.data ?? []) as Job[]);
      setEstimates((er.data ?? []) as Estimate[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Unique technicians (from non-null user_id/user_name)
  const techs = useMemo<Tech[]>(() => {
    const map = new Map<string, string>();
    jobs.forEach(j      => { if (j.user_id && j.user_name) map.set(j.user_id, j.user_name); });
    estimates.forEach(e => { if (e.user_id && e.user_name) map.set(e.user_id, e.user_name); });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [jobs, estimates]);

  // Available months in the data
  const months = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j      => set.add(j.created_at.slice(0, 7)));
    estimates.forEach(e => set.add(e.created_at.slice(0, 7)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [jobs, estimates]);

  // Filtered data for selected tech + month
  const fJobs = useMemo(() => {
    let r = jobs.filter(j => j.created_at.slice(0, 7) === selectedMonth);
    if (selectedTech !== "all") r = r.filter(j => j.user_id === selectedTech);
    return r;
  }, [jobs, selectedMonth, selectedTech]);

  const fEsts = useMemo(() => {
    let r = estimates.filter(e => e.created_at.slice(0, 7) === selectedMonth);
    if (selectedTech !== "all") r = r.filter(e => e.user_id === selectedTech);
    return r;
  }, [estimates, selectedMonth, selectedTech]);

  // Compute actuals from filtered data
  const actuals = useMemo<Record<string, number>>(() => {
    const totalRevenue  = fJobs.reduce((s, j) => s + ((j.subtotal ?? 0) / 100), 0);
    const serviceCalls  = fJobs.length;
    const jobsDone      = fJobs.filter(j => COMPLETED_STATUSES.has((j.appointment_status ?? "").toLowerCase())).length;
    const estCreated    = fEsts.length;
    const estSold       = fEsts.filter(e => SOLD_STATUSES.has((e.estimate_status ?? "").toLowerCase())).length;
    const avgTicket     = jobsDone    > 0 ? totalRevenue / jobsDone    : serviceCalls > 0 ? totalRevenue / serviceCalls : 0;
    const revPerCall    = serviceCalls > 0 ? totalRevenue / serviceCalls : 0;
    const estCloseRate  = estCreated  > 0 ? estSold / estCreated       : 0;
    return {
      total_revenue:  totalRevenue,
      avg_ticket:     avgTicket,
      rev_per_call:   revPerCall,
      est_created:    estCreated,
      est_sold:       estSold,
      est_close_rate: estCloseRate,
      service_calls:  serviceCalls,
      jobs_completed: jobsDone,
    };
  }, [fJobs, fEsts]);

  // Build KPI result rows
  const kpiRows = useMemo<KpiRow[]>(() =>
    KPI_DEFS.map(def => {
      if (def.noData) return { def, actual: null, rawScore: null, wtdScore: null, status: null };
      const actual   = actuals[def.id] ?? 0;
      const rawScore = calcRawScore(actual, def);
      const status   = getStatus(actual, def);
      const wtdScore = (rawScore / 100) * def.weight;
      return { def, actual, rawScore, wtdScore, status };
    }),
  [actuals]);

  // Normalized performance score (0–100 based on available KPI weight)
  const { perfScore, overallRating } = useMemo(() => {
    const available = kpiRows.filter(r => !r.def.noData && r.wtdScore !== null);
    const rawSum    = available.reduce((s, r) => s + (r.wtdScore ?? 0), 0);
    const perfScore = Math.min(120, Math.round((rawSum / AVAIL_WEIGHT) * 100));
    const overallRating: Status = perfScore >= 80 ? "GREEN" : perfScore >= 50 ? "YELLOW" : "RED";
    return { perfScore, overallRating };
  }, [kpiRows]);

  const coachKpis     = kpiRows.filter(r => r.status === "RED" || r.status === "YELLOW").map(r => r.def.label);
  const statusCounts  = kpiRows.reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<Status, number>>);
  const totalWtdScore = kpiRows.filter(r => !r.def.noData && r.wtdScore !== null).reduce((s, r) => s + (r.wtdScore ?? 0), 0);

  // Group by category (preserving definition order)
  const categories = useMemo(() => {
    const map = new Map<string, KpiRow[]>();
    kpiRows.forEach(r => {
      if (!map.has(r.def.category)) map.set(r.def.category, []);
      map.get(r.def.category)!.push(r);
    });
    return map;
  }, [kpiRows]);

  const techName = selectedTech === "all"
    ? "All Technicians"
    : (techs.find(t => t.id === selectedTech)?.name ?? "—");

  const scoreColor = overallRating === "GREEN" ? "text-emerald-600" : overallRating === "YELLOW" ? "text-amber-500" : "text-red-600";
  const scoreBorder = overallRating === "GREEN" ? "border-emerald-300" : overallRating === "YELLOW" ? "border-amber-300" : "border-red-300";
  const scoreBg    = overallRating === "GREEN" ? "bg-emerald-50"    : overallRating === "YELLOW" ? "bg-amber-50"    : "bg-red-50";
  const scoreBar   = overallRating === "GREEN" ? "bg-emerald-500"   : overallRating === "YELLOW" ? "bg-amber-400"   : "bg-red-500";

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="relative w-14 h-14 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
          <div className="absolute inset-0 rounded-full border-4 border-[#0d9488] border-t-transparent animate-spin" />
        </div>
        <p className="text-slate-700 font-bold">Loading scorecard…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center max-w-lg space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
        <h2 className="font-bold text-slate-900 text-lg">Failed to load data</h2>
        <pre className="text-xs bg-red-50 border border-red-100 rounded-xl p-4 text-red-800 whitespace-pre-wrap text-left">{error}</pre>
        <button onClick={load} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700">↺ Retry</button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Monthly Technician Scorecard</h1>
          <p className="text-sm text-slate-400 mt-0.5">8 of 12 KPIs available · 4 require additional data feeds</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-5">
          {/* Technician picker */}
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Technician</label>
            {techs.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <span>⚠️</span>
                <span className="font-medium">No technician data yet — user_name / user_id not populated by n8n</span>
              </div>
            ) : (
              <select
                value={selectedTech}
                onChange={e => setTech(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 font-semibold text-slate-800"
              >
                <option value="all">All Technicians (combined)</option>
                {techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          {/* Month picker */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setMonth(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 font-semibold text-slate-800"
            >
              {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
            </select>
          </div>

          {/* Quick summary inline */}
          <div className="flex items-end gap-4 ml-auto">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Viewing</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{techName} · {fmtMonth(selectedMonth)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

        {/* Score */}
        <div className={`rounded-2xl border-2 shadow-sm p-5 flex flex-col items-center justify-center text-center ${scoreBg} ${scoreBorder}`}>
          <p className={`text-5xl font-black leading-none ${scoreColor}`}>{perfScore}</p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">Perf. Score</p>
          <p className="text-[10px] text-slate-400 mt-1">8 of 12 KPIs</p>
        </div>

        {/* Rating */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col items-center justify-center text-center gap-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black ${
            overallRating === "GREEN"  ? "bg-emerald-100 text-emerald-700" :
            overallRating === "YELLOW" ? "bg-amber-100 text-amber-700"    : "bg-red-100 text-red-600"
          }`}>
            {overallRating === "GREEN" ? "✓" : overallRating === "YELLOW" ? "!" : "✕"}
          </div>
          <div>
            <p className={`text-lg font-black ${scoreColor}`}>{overallRating}</p>
            <p className="text-xs text-slate-400 font-medium">Overall Rating</p>
          </div>
        </div>

        {/* KPI status counts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 col-span-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">KPI Status Breakdown</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["GREEN","YELLOW","RED"] as Status[]).map(s => (
              <div key={s} className="text-center">
                <p className={`text-2xl font-black ${
                  s === "GREEN" ? "text-emerald-600" : s === "YELLOW" ? "text-amber-500" : "text-red-600"
                }`}>{statusCounts[s] ?? 0}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{s}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-full overflow-hidden h-2.5">
            {(["GREEN","YELLOW","RED"] as Status[]).map(s => {
              const count = statusCounts[s] ?? 0;
              const total = Object.values(statusCounts).reduce<number>((a, b) => a + (b ?? 0), 0);
              const pct   = total > 0 ? (count / total) * 100 : 0;
              const color = s === "GREEN" ? "bg-emerald-500" : s === "YELLOW" ? "bg-amber-400" : "bg-red-500";
              return pct > 0 ? <div key={s} className={`${color}`} style={{ width: `${pct}%` }} /> : null;
            })}
          </div>
        </div>
      </div>

      {/* KPI Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">KPI Breakdown</h2>
            <p className="text-xs text-slate-400 mt-0.5">{techName} · {fmtMonth(selectedMonth)}</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {(["GREEN","YELLOW","RED"] as Status[]).map(s => (
              <span key={s} className="flex items-center gap-1.5 font-semibold text-slate-500">
                <span className={`w-2 h-2 rounded-full ${s === "GREEN" ? "bg-emerald-500" : s === "YELLOW" ? "bg-amber-400" : "bg-red-500"}`} />
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Category","KPI","Actual","Target","Min Accept","World Class","Status","Weight","Score /120","Wtd Score"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap bg-slate-50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(categories.entries()).map(([cat, rows]) =>
                rows.map((r, i) => (
                  <tr key={r.def.id}
                    className={`border-b border-slate-50 transition-colors hover:bg-slate-50/60 ${r.status ? STATUS_STYLE[r.status].row : "opacity-60"}`}>

                    {/* Category — spans only first row visually */}
                    <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                      {i === 0 && (
                        <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white whitespace-nowrap"
                          style={{ backgroundColor: CAT_COLOR[cat] ?? "#64748b" }}>
                          {cat}
                        </span>
                      )}
                    </td>

                    {/* KPI name */}
                    <td className="px-4 py-3.5 font-semibold text-slate-800 whitespace-nowrap">
                      {r.def.label}
                      {r.def.noData && (
                        <span className="ml-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          NO FEED
                        </span>
                      )}
                    </td>

                    {/* Actual */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.actual !== null ? (
                        <span className="font-bold text-slate-900">{fmtVal(r.actual, r.def.format)}</span>
                      ) : (
                        <span className="text-slate-300 font-medium">—</span>
                      )}
                    </td>

                    {/* Benchmarks */}
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtVal(r.def.target, r.def.format)}</td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{fmtVal(r.def.min, r.def.format)}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700 whitespace-nowrap">{fmtVal(r.def.worldClass, r.def.format)}</td>

                    {/* Status badge */}
                    <td className="px-4 py-3.5">
                      {r.status ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLE[r.status].badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_STYLE[r.status].dot}`} />
                          {r.status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 font-medium">N/A</span>
                      )}
                    </td>

                    {/* Weight */}
                    <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">{r.def.weight}%</td>

                    {/* Raw score */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {r.rawScore !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${
                                r.status === "GREEN" ? "bg-emerald-500" :
                                r.status === "YELLOW" ? "bg-amber-400" : "bg-red-400"
                              }`}
                              style={{ width: `${Math.min(100, (r.rawScore / 120) * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-600">{r.rawScore.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Weighted score */}
                    <td className="px-4 py-3.5 font-bold whitespace-nowrap">
                      {r.wtdScore !== null ? (
                        <span className={
                          r.wtdScore >= r.def.weight * 0.8 ? "text-emerald-700" :
                          r.wtdScore >= r.def.weight * 0.4 ? "text-amber-600"  : "text-red-600"
                        }>
                          {r.wtdScore.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={7} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Totals (8 of 12 KPIs · {AVAIL_WEIGHT}% weight)
                </td>
                <td className="px-4 py-3 font-bold text-slate-600">{AVAIL_WEIGHT}%</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 font-black text-lg text-slate-900">{totalWtdScore.toFixed(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Performance Score banner */}
      <div className={`rounded-2xl border-2 p-6 ${scoreBg} ${scoreBorder}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Performance Score (0–100)</p>
            <div className="flex items-end gap-3 mb-2">
              <span className={`text-6xl font-black leading-none ${scoreColor}`}>{perfScore}</span>
              <span className={`text-2xl font-black mb-1 ${scoreColor}`}>{overallRating}</span>
            </div>
            <p className="text-xs text-slate-500">
              Normalized across {AVAIL_WEIGHT}% available KPI weight · 4 KPIs (40% weight) await additional data feeds
            </p>
          </div>

          {/* Score bar */}
          <div className="sm:w-72">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
              <span>0 · RED</span><span>50 · YELLOW</span><span>80 · GREEN</span><span>100</span>
            </div>
            <div className="relative h-5 bg-slate-200 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="bg-red-200/80"    style={{ width: "50%" }} />
                <div className="bg-amber-200/80"  style={{ width: "30%" }} />
                <div className="bg-emerald-200/80" style={{ width: "20%" }} />
              </div>
              <div
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${scoreBar}`}
                style={{ width: `${Math.min(perfScore, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Coaching Focus */}
      {coachKpis.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-lg flex-shrink-0">🎯</div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Coaching Focus</p>
              <p className="text-xs text-slate-400">Auto-flagged RED &amp; YELLOW KPIs for this period</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {coachKpis.map(k => (
              <span key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing data notice — hidden until data feeds are connected */}

    </div>
  );
}
