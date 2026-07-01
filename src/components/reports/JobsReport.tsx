"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/calculations";

interface Appointment {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
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
  estimate_requested: boolean;
  estimate_status: string | null;
  total_amount: number | null;
  created_at: string;
}

interface MonthCount { month: string; count: number }

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function JobsReport() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [estimates, setEstimates]       = useState<Estimate[]>([]);
  const [apptByMonth, setApptByMonth]   = useState<MonthCount[]>([]);
  const [estByMonth, setEstByMonth]     = useState<MonthCount[]>([]);
  const [totalAppts, setTotalAppts]     = useState(0);
  const [totalEsts, setTotalEsts]       = useState(0);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<"jobs" | "estimates">("jobs");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [apptRes, estRes, apptCountRes, estCountRes] = await Promise.all([
          supabase
            .from("appointments")
            .select("id,name,phone,email,appointment_requested,appointment_status,subtotal,created_at")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("estimates")
            .select("id,name,phone,email,estimate_requested,estimate_status,total_amount,created_at")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase.from("appointments").select("*", { count: "exact", head: true }),
          supabase.from("estimates").select("*", { count: "exact", head: true }),
        ]);

        const apptData = (apptRes.data ?? []) as Appointment[];
        const estData  = (estRes.data ?? []) as Estimate[];

        setAppointments(apptData);
        setEstimates(estData);
        setTotalAppts(apptCountRes.count ?? 0);
        setTotalEsts(estCountRes.count ?? 0);

        // Month breakdown from loaded records
        const apptMonths: Record<string, number> = {};
        apptData.forEach((r: Appointment) => {
          const m = r.created_at.slice(0, 7);
          apptMonths[m] = (apptMonths[m] ?? 0) + 1;
        });
        setApptByMonth(
          Object.entries(apptMonths)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, count]) => ({ month, count }))
        );

        const estMonths: Record<string, number> = {};
        estData.forEach((r: Estimate) => {
          const m = r.created_at.slice(0, 7);
          estMonths[m] = (estMonths[m] ?? 0) + 1;
        });
        setEstByMonth(
          Object.entries(estMonths)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, count]) => ({ month, count }))
        );
      } catch (err) {
        console.error("Failed to load jobs/estimates:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const requestedAppts  = appointments.filter((a) => a.appointment_requested).length;
  const requestedEsts   = estimates.filter((e) => e.estimate_requested).length;
  const apptRevenue     = appointments.reduce((s, a) => s + (a.subtotal ?? 0), 0);
  const estRevenue      = estimates.reduce((s, e) => s + (e.total_amount ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading jobs & estimates…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card stat-navy px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Jobs</p>
          <p className="text-2xl font-black text-brand-navy mt-1">{totalAppts}</p>
          <p className="text-xs text-gray-400 mt-0.5">from HousecallPro</p>
        </div>
        <div className="card stat-teal px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Estimates</p>
          <p className="text-2xl font-black text-brand-teal-dk mt-1">{totalEsts}</p>
          <p className="text-xs text-gray-400 mt-0.5">from HousecallPro</p>
        </div>
        <div className="card stat-orange px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Appt. Requested</p>
          <p className="text-2xl font-black text-brand-orange-dk mt-1">{requestedAppts}</p>
          <p className="text-xs text-gray-400 mt-0.5">via AI call</p>
        </div>
        <div className="card border-l-4 border-l-emerald-500 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. Requested</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{requestedEsts}</p>
          <p className="text-xs text-gray-400 mt-0.5">via AI call</p>
        </div>
      </div>

      {/* Revenue if available */}
      {(apptRevenue > 0 || estRevenue > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card stat-navy px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Jobs Revenue</p>
            <p className="text-2xl font-black text-brand-navy mt-1">{formatCurrency(apptRevenue)}</p>
          </div>
          <div className="card stat-teal px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estimates Value</p>
            <p className="text-2xl font-black text-brand-teal-dk mt-1">{formatCurrency(estRevenue)}</p>
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold text-brand-navy mb-3 text-sm uppercase tracking-wide">Jobs by Month</h3>
          {apptByMonth.length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <div className="space-y-2">
              {apptByMonth.map(({ month, count }) => {
                const max = Math.max(...apptByMonth.map((m) => m.count));
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">
                      {new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-brand-navy h-2 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-brand-navy w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-brand-teal-dk mb-3 text-sm uppercase tracking-wide">Estimates by Month</h3>
          {estByMonth.length === 0 ? (
            <p className="text-sm text-gray-400">No data</p>
          ) : (
            <div className="space-y-2">
              {estByMonth.map(({ month, count }) => {
                const max = Math.max(...estByMonth.map((m) => m.count));
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">
                      {new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-brand-teal h-2 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-brand-teal-dk w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sub-tab selector */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === "jobs" ? "bg-white text-brand-navy shadow-sm border border-gray-200" : "text-gray-500 hover:text-brand-navy"}`}
        >
          Jobs / Appointments ({totalAppts})
        </button>
        <button
          onClick={() => setActiveTab("estimates")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === "estimates" ? "bg-white text-brand-navy shadow-sm border border-gray-200" : "text-gray-500 hover:text-brand-navy"}`}
        >
          Estimates ({totalEsts})
        </button>
      </div>

      {/* Jobs table */}
      {activeTab === "jobs" && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-brand-navy">Recent Jobs (showing latest 50)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Customer", "Phone", "Email", "Appt. Requested", "Subtotal", "Status", "Created"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-brand-navy">{a.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{a.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{a.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {a.appointment_requested
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Yes</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.subtotal != null ? formatCurrency(a.subtotal) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full capitalize">
                        {a.appointment_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estimates table */}
      {activeTab === "estimates" && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-brand-navy">Recent Estimates (showing latest 50)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Customer", "Phone", "Email", "Est. Requested", "Amount", "Status", "Created"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {estimates.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-brand-navy">{e.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{e.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{e.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {e.estimate_requested
                        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Yes</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {e.total_amount != null ? formatCurrency(e.total_amount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full capitalize">
                        {e.estimate_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
