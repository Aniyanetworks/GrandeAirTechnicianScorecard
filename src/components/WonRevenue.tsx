"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { isWonOption, wonOptions, paymentsBetween, type WonEstimate } from "@/lib/won";

// ── Data hook ─────────────────────────────────────────────────────────────────

export function useWonEstimates() {
  const [estimates, setEstimates] = useState<WonEstimate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const PAGE_SIZE = 1000;
      const all: WonEstimate[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const res = await supabase
          .from("hcp_estimates")
          .select("id,number,customer,sent_by,created_at,options")
          .eq("has_won", true)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (res.error) throw new Error(res.error.message);
        for (const r of res.data ?? []) {
          all.push({
            id: r.id, number: r.number ?? "", customer: r.customer ?? "—",
            sentBy: r.sent_by, createdAt: r.created_at,
            // rows synced before the paid logic have no payments; treat them as unpaid
            options: ((r.options ?? []) as WonEstimate["options"]).map(o => ({ ...o, payments: o.payments ?? [] })),
          });
        }
        if (!res.data || res.data.length < PAGE_SIZE) break;
      }
      setEstimates(all);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { estimates, loading, error, updatedAt, reload: load };
}

// ── Period maths ──────────────────────────────────────────────────────────────

export type Period = "today" | "week" | "month" | "year";

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

// [start, endExclusive) for a period ending today; `yearsBack` shifts it to the same dates in a past year
function range(period: Period, now: Date, yearsBack = 0): [Date, Date] {
  const y = now.getFullYear() - yearsBack, m = now.getMonth(), d = now.getDate();
  const end = new Date(y, m, d + 1);
  if (period === "today") return [new Date(y, m, d), end];
  if (period === "week")  return [new Date(y, m, d - now.getDay()), end];
  if (period === "month") return [new Date(y, m, 1), end];
  return [new Date(y, 0, 1), end];
}

interface Totals { total: number; count: number }

function totalsBetween(estimates: WonEstimate[], start: Date, end: Date): Totals {
  let total = 0;
  const ids = new Set<string>();
  for (const e of estimates) {
    for (const o of wonOptions(e)) {
      for (const pay of paymentsBetween(o, start, end)) { total += pay.amount; ids.add(e.id); }
    }
  }
  return { total, count: ids.size };
}

export function useWonStats(estimates: WonEstimate[]) {
  return useMemo(() => {
    const now = new Date();
    const periods: Period[] = ["today", "week", "month", "year"];
    const stats = {} as Record<Period, { cur: Totals; prev: Totals }>;
    for (const p of periods) {
      const [s, e]   = range(p, now);
      const [ps, pe] = range(p, now, 1);
      stats[p] = { cur: totalsBetween(estimates, s, e), prev: totalsBetween(estimates, ps, pe) };
    }
    return { now, stats };
  }, [estimates]);
}

// ── Compare card (also the period selector) ───────────────────────────────────

const PERIOD_LABEL: Record<Period, string> = {
  today: "Won Today", week: "Week to Date", month: "Month to Date", year: "Year to Date",
};

function CompareCard({
  period, active, cur, prev, onClick,
}: { period: Period; active: boolean; cur: Totals; prev: Totals; onClick: () => void }) {
  const diff = cur.total - prev.total;
  const pct  = prev.total > 0 ? (diff / prev.total) * 100 : null;
  const up   = diff >= 0;

  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border-2 p-5 transition-all ${
        active ? "border-[#0d9488] shadow-lg" : "border-slate-100 shadow-sm hover:border-[#0d9488]/30 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{PERIOD_LABEL[period]}</p>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${up ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
          {pct === null ? (cur.total > 0 ? "New" : "—") : `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`}
        </span>
      </div>
      <p className="font-black text-slate-900 mt-2 text-3xl">{fmtMoney(cur.total)}</p>
      <p className="text-xs text-slate-400 mt-1">{cur.count} estimate{cur.count !== 1 ? "s" : ""} won</p>
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
        <span className="text-slate-500">Last year</span>
        <span className="font-semibold text-slate-700">
          {fmtMoney(prev.total)} <span className="text-xs text-slate-400 font-normal">· {prev.count}</span>
        </span>
      </div>
      <p className={`text-xs font-semibold mt-2 ${up ? "text-emerald-600" : "text-red-600"}`}>
        {up ? "+" : "−"}{fmtMoney(Math.abs(diff))} vs last year
      </p>
    </button>
  );
}

// ── Tab body ──────────────────────────────────────────────────────────────────

export default function WonRevenue({
  estimates, loading, error, updatedAt, onRefresh,
}: {
  estimates: WonEstimate[]; loading: boolean; error: string | null;
  updatedAt: Date | null; onRefresh: () => void;
}) {
  const { now, stats } = useWonStats(estimates);
  const [period, setPeriod] = useState<Period>("today");

  const y = now.getFullYear();

  const monthly = useMemo(() => {
    const data = MON.map(label => ({ label, [String(y)]: 0, [String(y - 1)]: 0 }) as Record<string, number | string>);
    for (const e of estimates) {
      for (const o of wonOptions(e)) {
        for (const pay of o.payments) {
          const t = new Date(pay.paidAt);
          const yr = t.getFullYear();
          if (yr !== y && yr !== y - 1) continue;
          data[t.getMonth()][String(yr)] = (data[t.getMonth()][String(yr)] as number) + pay.amount;
        }
      }
    }
    return data;
  }, [estimates, y]);

  // Estimates won in the selected period, newest first
  const list = useMemo(() => {
    const [s, e] = range(period, now);
    return estimates
      .map(est => {
        const pays = wonOptions(est).flatMap(o => paymentsBetween(o, s, e));
        if (!pays.length) return null;
        const at = new Date(Math.max(...pays.map(p => new Date(p.paidAt).getTime())));
        return { est, at, amount: pays.reduce((sum, p) => sum + p.amount, 0) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [estimates, period, now]);

  if (loading && !estimates.length) return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center space-y-3">
      <div className="relative w-10 h-10 mx-auto">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
        <div className="absolute inset-0 rounded-full border-4 border-[#0d9488] border-t-transparent animate-spin" />
      </div>
      <p className="text-sm font-semibold text-slate-700">Loading won estimates…</p>
    </div>
  );

  if (error && !estimates.length) return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center space-y-3">
      <p className="font-bold text-slate-900">Couldn&apos;t load won estimates</p>
      <pre className="text-left text-xs bg-red-50 border border-red-100 rounded-xl p-4 text-red-800 whitespace-pre-wrap break-all">{error}</pre>
      <button onClick={onRefresh} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700">↺ Retry</button>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Period cards — click to list what was won */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(["today", "week", "month", "year"] as Period[]).map(p => (
          <CompareCard key={p} period={p} active={period === p}
            cur={stats[p].cur} prev={stats[p].prev} onClick={() => setPeriod(p)} />
        ))}
      </div>

      {/* Monthly chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-bold text-slate-900 mb-4">Monthly Won — {y} vs {y - 1}</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} />
            <Tooltip formatter={(v: number) => fmtMoney(v)} cursor={{ fill: "#f8fafc" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12 }} />
            <Bar dataKey={String(y - 1)} fill="#cbd5e1" radius={[5, 5, 0, 0]} maxBarSize={28} />
            <Bar dataKey={String(y)}     fill="#0d9488" radius={[5, 5, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Won list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-white flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">{PERIOD_LABEL[period]} — {list.length} won · {fmtMoney(stats[period].cur.total)}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Only money paid on the option the client chose is counted.
              {updatedAt && <> Updated {updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.</>}
            </p>
          </div>
          <button onClick={onRefresh} disabled={loading}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Estimate</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Options sent → chosen</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-left">Sent by</th>
                <th className="px-4 py-3 text-left">Paid on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-slate-400">Nothing paid in this period yet.</td></tr>
              )}
              {list.map(({ est, at, amount }) => (
                <tr key={est.id} className="align-top">
                  <td className="px-4 py-3 font-semibold text-slate-700">#{est.number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{est.customer}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {est.options.map((o, i) => (
                        <span key={i}
                          className={`text-xs px-2 py-1 rounded-lg border ${
                            isWonOption(o)
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold"
                              : "bg-slate-50 border-slate-200 text-slate-400 line-through"
                          }`}>
                          {o.name} · {fmtMoney(o.amount)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-emerald-600">{fmtMoney(amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{est.sentBy ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
