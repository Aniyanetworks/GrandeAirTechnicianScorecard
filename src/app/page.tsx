"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipProps,
} from "recharts";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  call_summary_id: string | null;
  appointment_requested: boolean;
  appointment_status: string | null;
  subtotal: number | null;
  created_at: string;
}

interface Estimate {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  call_summary_id: string | null;
  estimate_requested: boolean;
  estimate_status: string | null;
  total_amount: number | null;
  created_at: string;
}

type QuickDate = "all" | "week" | "month" | "last_month";
type Source    = "all" | "ai" | "direct";
type Tab       = "jobs" | "estimates";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDT(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function weekRange(offset = 0) {
  const now = new Date();
  const sun = new Date(now);
  sun.setDate(now.getDate() - now.getDay() + offset * 7);
  sun.setHours(0, 0, 0, 0);
  const next = new Date(sun);
  next.setDate(sun.getDate() + 7);
  return [sun, next] as const;
}

function monthRange(offset = 0) {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return [s, e] as const;
}

function dateFilter<T extends { created_at: string }>(items: T[], qd: QuickDate): T[] {
  if (qd === "all") return items;
  const [s, e] =
    qd === "week"       ? weekRange(0)  :
    qd === "month"      ? monthRange(0) :
                          monthRange(-1);
  return items.filter(i => { const d = new Date(i.created_at); return d >= s && d < e; });
}

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  trendCur?: number;
  trendPrev?: number;
}

function StatCard({ label, value, sub, icon, iconBg, iconColor, trendCur, trendPrev }: StatCardProps) {
  let trend: React.ReactNode = null;
  if (trendCur !== undefined && trendPrev !== undefined) {
    if (trendPrev === 0 && trendCur > 0) {
      trend = (
        <p className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
          <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">NEW</span>
          +{trendCur} this week
        </p>
      );
    } else if (trendPrev > 0) {
      const pct = Math.round(((trendCur - trendPrev) / trendPrev) * 100);
      const up  = pct >= 0;
      trend = (
        <p className={`mt-2 text-xs font-semibold flex items-center gap-1 ${up ? "text-emerald-600" : "text-red-500"}`}>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${up ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>
            {up ? "▲" : "▼"} {Math.abs(pct)}%
          </span>
          vs last week
        </p>
      );
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right leading-tight">{label}</p>
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900 leading-none tracking-tight">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
        {trend}
      </div>
    </div>
  );
}

// ── Custom Tooltip for Recharts ───────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.fill }} />
            {p.dataKey}
          </span>
          <span className="font-bold text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Combined Recharts Bar Chart ───────────────────────────────────────────────

// Safe label from "YYYY-MM" string — no Date object, no timezone shift
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMonthKey(k: string) {
  const [yr, mo] = k.split("-");
  return `${MON[parseInt(mo, 10) - 1]} '${yr.slice(2)}`;
}

function CombinedChart({ jobs, estimates }: { jobs: Job[]; estimates: Estimate[] }) {
  const data = useMemo(() => {
    const map: Record<string, { key: string; Jobs: number; Estimates: number }> = {};
    jobs.forEach(j => {
      const k = j.created_at.slice(0, 7);
      if (!map[k]) map[k] = { key: k, Jobs: 0, Estimates: 0 };
      map[k].Jobs++;
    });
    estimates.forEach(e => {
      const k = e.created_at.slice(0, 7);
      if (!map[k]) map[k] = { key: k, Jobs: 0, Estimates: 0 };
      map[k].Estimates++;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [jobs, estimates]);

  if (!data.length) {
    return <p className="text-center text-slate-400 py-10 text-sm">No data to display yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="key"
          tickFormatter={fmtMonthKey}
          tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, "dataMax"]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: "#f8fafc", radius: 6 }}
          labelFormatter={fmtMonthKey}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={v => <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{v}</span>}
          wrapperStyle={{ paddingTop: 16 }}
        />
        <Bar dataKey="Jobs"      fill="#1e3a5f" radius={[5, 5, 0, 0]} maxBarSize={36} />
        <Bar dataKey="Estimates" fill="#0d9488" radius={[5, 5, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  search: string; onSearch: (v: string) => void;
  quickDate: QuickDate; onDate: (v: QuickDate) => void;
  source: Source; onSource: (v: Source) => void;
  requestedOnly: boolean; onRequested: (v: boolean) => void;
  hasActive: boolean; onClear: () => void;
}

function FilterBar({ search, onSearch, quickDate, onDate, source, onSource, requestedOnly, onRequested, hasActive, onClear }: FilterBarProps) {
  const dateOpts: { v: QuickDate; label: string }[] = [
    { v: "all", label: "All Time" }, { v: "week", label: "This Week" },
    { v: "month", label: "This Month" }, { v: "last_month", label: "Last Month" },
  ];
  const srcOpts: { v: Source; label: string }[] = [
    { v: "all", label: "All" }, { v: "ai", label: "📞 AI Call" }, { v: "direct", label: "HCP Direct" },
  ];

  function SegGroup<T extends string>({ opts, value, onChange }: { opts: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
      <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
        {opts.map(o => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              value === o.v ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-slate-50 placeholder-slate-400"
        />
        {search && (
          <button onClick={() => onSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold">✕</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegGroup opts={dateOpts} value={quickDate} onChange={onDate} />
        <SegGroup opts={srcOpts} value={source} onChange={onSource} />

        <button
          onClick={() => onRequested(!requestedOnly)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            requestedOnly
              ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
          }`}
        >
          ✓ Requested Only
        </button>

        {hasActive && (
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 ml-1 transition-colors">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

function SourceBadge({ ai }: { ai: boolean }) {
  return ai ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full whitespace-nowrap">
      📞 AI Call
    </span>
  ) : (
    <span className="inline-flex items-center text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full whitespace-nowrap">
      HCP
    </span>
  );
}

function ReqBadge({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
      ✓ Yes
    </span>
  ) : <span className="text-slate-300 text-xs">—</span>;
}

function StatusBadge({ status }: { status: string | null }) {
  return (
    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full capitalize">
      {status || "pending"}
    </span>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pager({ page, pages, total, size, onChange }: { page: number; pages: number; total: number; size: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const from = (page - 1) * size + 1;
  const to   = Math.min(page * size, total);

  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(n =>
    n === 1 || n === pages || Math.abs(n - page) <= 1
  );

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 font-medium rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200">
        ← Prev
      </button>

      <div className="flex items-center gap-1">
        {nums.map((n, i) => {
          const prev = nums[i - 1];
          const gap  = prev && n - prev > 1;
          return (
            <span key={n} className="flex items-center gap-1">
              {gap && <span className="text-slate-300 text-xs px-1">…</span>}
              <button
                onClick={() => onChange(n)}
                className={`w-8 h-8 text-xs font-semibold rounded-lg transition-all ${
                  n === page
                    ? "bg-[#1e3a5f] text-white shadow-sm"
                    : "text-slate-500 hover:bg-white hover:shadow-sm hover:border hover:border-slate-200"
                }`}
              >
                {n}
              </button>
            </span>
          );
        })}
      </div>

      <span className="text-xs text-slate-400 hidden sm:block">{from}–{to} of {total}</span>

      <button onClick={() => onChange(page + 1)} disabled={page === pages}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 font-medium rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-transparent hover:border-slate-200">
        Next →
      </button>
    </div>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────────

function TableCard({ title, count, total, page, pages, children, onPageChange }: {
  title: string; count: number; total: number;
  page: number; pages: number;
  children: React.ReactNode;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900">{title}</span>
          {count !== total ? (
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {count} of {total}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {total} total
            </span>
          )}
        </div>
        {pages > 1 && (
          <span className="text-xs text-slate-400">Page {page} / {pages}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        {children}
      </div>
      <Pager page={page} pages={pages} total={count} size={20} onChange={onPageChange} />
    </div>
  );
}

// ── Section Selector Card ─────────────────────────────────────────────────────

function SectionTab({
  type, active, count, weekCount, aiCount, recentName, onClick,
}: {
  type: "jobs" | "estimates";
  active: boolean;
  count: number;
  weekCount: number;
  aiCount: number;
  recentName: string | null;
  onClick: () => void;
}) {
  const isJob   = type === "jobs";
  const accent  = isJob ? "#1e3a5f" : "#0d9488";
  const label   = isJob ? "Jobs / Appointments" : "Estimates";
  const icon    = isJob ? "🔧" : "📋";
  const hoverBg = isJob ? "hover:border-[#1e3a5f]/30" : "hover:border-[#0d9488]/30";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-5 text-left transition-all duration-200 group ${hoverBg} ${
        active ? "shadow-lg" : "bg-white border-slate-100 hover:shadow-md"
      }`}
      style={active ? { borderColor: accent, background: `linear-gradient(135deg, ${accent}08 0%, white 60%)` } : {}}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm transition-all"
            style={{ backgroundColor: active ? accent : "#f1f5f9", color: active ? "white" : "#94a3b8" }}
          >
            {icon}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">{label}</p>
            {recentName && (
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[140px]">
                Latest: {recentName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active ? (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: accent }}
            >
              Viewing
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600 transition-colors flex items-center gap-1">
              View <span className="text-base">→</span>
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <div className="pr-4">
          <p className="text-2xl font-black text-slate-900 leading-none">{count}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Total</p>
        </div>
        <div className="px-4">
          <p className="text-2xl font-black leading-none" style={{ color: active ? accent : "#334155" }}>
            {weekCount}
          </p>
          <p className="text-xs text-slate-400 mt-1 font-medium">This week</p>
        </div>
        <div className="pl-4">
          <p className="text-2xl font-black text-violet-600 leading-none">{aiCount}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">via AI</p>
        </div>
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PS = 20;

export default function DashboardPage() {
  const [jobs,      setJobs]      = useState<Job[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [tab,           setTab]       = useState<Tab>("jobs");
  const [search,        setSearch]    = useState("");
  const [quickDate,     setQuickDate] = useState<QuickDate>("all");
  const [source,        setSource]    = useState<Source>("all");
  const [requestedOnly, setReqOnly]   = useState(false);
  const [jobPage,       setJobPage]   = useState(1);
  const [estPage,       setEstPage]   = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const jr = await supabase
        .from("appointments")
        .select("id,name,phone,email,call_summary_id,appointment_requested,appointment_status,subtotal,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (jr.error) throw new Error(`appointments: ${jr.error.message}`);

      const er = await supabase
        .from("estimates")
        .select("id,name,phone,email,call_summary_id,estimate_requested,estimate_status,total_amount,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (er.error) throw new Error(`estimates: ${er.error.message}`);

      setJobs((jr.data ?? []) as Job[]);
      setEstimates((er.data ?? []) as Estimate[]);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setJobPage(1); setEstPage(1); }, [search, quickDate, source, requestedOnly]);

  // ── Weekly stats ──────────────────────────────────────────────────────────
  const [twS, twE] = useMemo(() => weekRange(0),  []);
  const [lwS, lwE] = useMemo(() => weekRange(-1), []);

  const thisWkJobs = useMemo(() => jobs.filter(j => { const d = new Date(j.created_at); return d >= twS && d < twE; }), [jobs, twS, twE]);
  const lastWkJobs = useMemo(() => jobs.filter(j => { const d = new Date(j.created_at); return d >= lwS && d < lwE; }), [jobs, lwS, lwE]);
  const thisWkEsts = useMemo(() => estimates.filter(e => { const d = new Date(e.created_at); return d >= twS && d < twE; }), [estimates, twS, twE]);
  const lastWkEsts = useMemo(() => estimates.filter(e => { const d = new Date(e.created_at); return d >= lwS && d < lwE; }), [estimates, lwS, lwE]);
  const thisWkEstVal = useMemo(() => thisWkEsts.reduce((s, e) => s + (e.total_amount ?? 0), 0), [thisWkEsts]);

  const aiJobs   = useMemo(() => jobs.filter(j => !!j.call_summary_id).length, [jobs]);
  const aiEsts   = useMemo(() => estimates.filter(e => !!e.call_summary_id).length, [estimates]);
  const aiTotal  = aiJobs + aiEsts;
  const reqTotal = useMemo(() =>
    jobs.filter(j => j.appointment_requested).length +
    estimates.filter(e => e.estimate_requested).length, [jobs, estimates]);

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    let r = dateFilter(jobs, quickDate);
    if (source === "ai")     r = r.filter(j => !!j.call_summary_id);
    if (source === "direct") r = r.filter(j => !j.call_summary_id);
    if (requestedOnly)       r = r.filter(j => j.appointment_requested);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(j =>
        (j.name ?? "").toLowerCase().includes(q) ||
        (j.phone ?? "").includes(q) ||
        (j.email ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [jobs, search, quickDate, source, requestedOnly]);

  const filteredEsts = useMemo(() => {
    let r = dateFilter(estimates, quickDate);
    if (source === "ai")     r = r.filter(e => !!e.call_summary_id);
    if (source === "direct") r = r.filter(e => !e.call_summary_id);
    if (requestedOnly)       r = r.filter(e => e.estimate_requested);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(e =>
        (e.name ?? "").toLowerCase().includes(q) ||
        (e.phone ?? "").includes(q) ||
        (e.email ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [estimates, search, quickDate, source, requestedOnly]);

  const jobPages  = Math.ceil(filteredJobs.length / PS);
  const estPages  = Math.ceil(filteredEsts.length / PS);
  const pagedJobs = filteredJobs.slice((jobPage - 1) * PS, jobPage * PS);
  const pagedEsts = filteredEsts.slice((estPage - 1) * PS, estPage * PS);

  const hasFilter = !!(search || quickDate !== "all" || source !== "all" || requestedOnly);
  function clearFilters() { setSearch(""); setQuickDate("all"); setSource("all"); setReqOnly(false); }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="relative w-14 h-14 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
          <div className="absolute inset-0 rounded-full border-4 border-[#0d9488] border-t-transparent animate-spin" />
        </div>
        <div>
          <p className="text-slate-800 font-bold">Loading dashboard</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to Supabase…</p>
        </div>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center space-y-4 max-w-lg">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
        <h2 className="font-bold text-slate-900 text-lg">Failed to load data</h2>
        <pre className="text-left text-xs bg-red-50 border border-red-100 rounded-xl p-4 text-red-800 whitespace-pre-wrap break-all">{error}</pre>
        <p className="text-xs text-slate-400">URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)"}</p>
        <button onClick={load} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors">
          ↺ Retry
        </button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Live Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              HousecallPro → n8n → Supabase
            </span>
            {updatedAt && (
              <span>· Updated {updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Jobs"  value={jobs.length} sub="all appointments"
          icon="🔧" iconBg="bg-slate-100" iconColor="text-slate-700"
        />
        <StatCard
          label="Total Estimates" value={estimates.length} sub="all estimates"
          icon="📋" iconBg="bg-teal-50" iconColor="text-teal-700"
        />
        <StatCard
          label="Jobs This Week" value={thisWkJobs.length}
          sub={`${lastWkJobs.length} last week`}
          icon="📅" iconBg="bg-blue-50" iconColor="text-blue-700"
          trendCur={thisWkJobs.length} trendPrev={lastWkJobs.length}
        />
        <StatCard
          label="Est. Value This Week"
          value={thisWkEstVal > 0 ? fmtMoney(thisWkEstVal) : `${thisWkEsts.length}`}
          sub={thisWkEstVal > 0 ? `${thisWkEsts.length} estimates` : "estimates this week"}
          icon="💰" iconBg="bg-violet-50" iconColor="text-violet-700"
          trendCur={thisWkEsts.length} trendPrev={lastWkEsts.length}
        />
        <StatCard
          label="AI-Powered" value={aiTotal} sub="via AI phone call"
          icon="🤖" iconBg="bg-amber-50" iconColor="text-amber-700"
        />
        <StatCard
          label="Requested" value={reqTotal} sub="customer confirmed"
          icon="✅" iconBg="bg-emerald-50" iconColor="text-emerald-700"
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-0 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Jobs & Estimates — Monthly Volume</h2>
            <p className="text-xs text-slate-400 mt-0.5">Records received per month via HousecallPro → n8n webhook</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1e3a5f] inline-block" /> Jobs
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0d9488] inline-block" /> Estimates
            </span>
          </div>
        </div>
        <div className="px-6 pb-4 pt-2">
          <CombinedChart jobs={jobs} estimates={estimates} />
        </div>
      </div>

      {/* ── Section selector cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionTab
          type="jobs" active={tab === "jobs"}
          count={jobs.length} weekCount={thisWkJobs.length} aiCount={aiJobs}
          recentName={jobs[0]?.name ?? null}
          onClick={() => setTab("jobs")}
        />
        <SectionTab
          type="estimates" active={tab === "estimates"}
          count={estimates.length} weekCount={thisWkEsts.length} aiCount={aiEsts}
          recentName={estimates[0]?.name ?? null}
          onClick={() => setTab("estimates")}
        />
      </div>

      {/* ── Shared filter bar ──────────────────────────────────────────── */}
      <FilterBar
        search={search} onSearch={setSearch}
        quickDate={quickDate} onDate={setQuickDate}
        source={source} onSource={setSource}
        requestedOnly={requestedOnly} onRequested={setReqOnly}
        hasActive={hasFilter} onClear={clearFilters}
      />

      {/* ── Jobs ─────────────────────────────────────────────────────────── */}
      {tab === "jobs" && (
        <TableCard title="Jobs / Appointments" count={filteredJobs.length} total={jobs.length}
          page={jobPage} pages={jobPages} onPageChange={setJobPage}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Customer", "Phone", "Email", "Created", "Source", "Requested", "Subtotal", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedJobs.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">No jobs match your filters.</td></tr>
              ) : pagedJobs.map((j, i) => (
                <tr key={j.id} className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap max-w-[160px] truncate">
                    {j.name || <span className="italic text-slate-300 font-normal">Unknown</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{j.phone || "—"}</td>
                  <td className="px-4 py-3.5 text-slate-500 max-w-[160px] truncate">{j.email || "—"}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmtDT(j.created_at)}</td>
                  <td className="px-4 py-3.5"><SourceBadge ai={!!j.call_summary_id} /></td>
                  <td className="px-4 py-3.5"><ReqBadge yes={j.appointment_requested} /></td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">
                    {j.subtotal != null ? fmtMoney(j.subtotal) : <span className="text-slate-300 font-normal text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={j.appointment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {/* ── Estimates ────────────────────────────────────────────────────── */}
      {tab === "estimates" && (
        <TableCard title="Estimates" count={filteredEsts.length} total={estimates.length}
          page={estPage} pages={estPages} onPageChange={setEstPage}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Customer", "Phone", "Email", "Created", "Source", "Requested", "Amount", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedEsts.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">No estimates match your filters.</td></tr>
              ) : pagedEsts.map((e, i) => (
                <tr key={e.id} className={`border-b border-slate-50 hover:bg-teal-50/30 transition-colors ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap max-w-[160px] truncate">
                    {e.name || <span className="italic text-slate-300 font-normal">Unknown</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{e.phone || "—"}</td>
                  <td className="px-4 py-3.5 text-slate-500 max-w-[160px] truncate">{e.email || "—"}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{fmtDT(e.created_at)}</td>
                  <td className="px-4 py-3.5"><SourceBadge ai={!!e.call_summary_id} /></td>
                  <td className="px-4 py-3.5"><ReqBadge yes={e.estimate_requested} /></td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">
                    {e.total_amount != null ? fmtMoney(e.total_amount) : <span className="text-slate-300 font-normal text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={e.estimate_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
