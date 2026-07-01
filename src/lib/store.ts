import { supabase } from "./supabase";
import type { Technician, WeeklyEntry } from "./types";

// ── mappers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTech(row: any): Technician {
  return {
    id: row.id,
    name: row.name,
    hireDate: row.hire_date ?? "",
    role: row.role ?? "",
    weeklyRevenueTarget: Number(row.weekly_revenue_target ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntry(row: any): WeeklyEntry {
  return {
    id: row.id,
    techId: row.tech_id,
    weekOf: row.week_of,
    jobsCompleted: Number(row.jobs_completed ?? 0),
    totalRevenue: Number(row.total_revenue ?? 0),
    maintenanceAgreementsSold: Number(row.maintenance_agreements_sold ?? 0),
    callbackJobs: Number(row.callback_jobs ?? 0),
    firstCallCompletions: Number(row.first_call_completions ?? 0),
    lateArrivals: Number(row.late_arrivals ?? 0),
    customerRatingSum: Number(row.customer_rating_sum ?? 0),
    customerRatingCount: Number(row.customer_rating_count ?? 0),
    hoursWorked: Number(row.hours_worked ?? 0),
  };
}

// ── technicians ───────────────────────────────────────────────────────────────

export async function getTechnicians(): Promise<Technician[]> {
  const { data, error } = await supabase
    .from("technicians")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapTech);
}

export async function saveTechnicians(techs: Technician[]): Promise<void> {
  const rows = techs.map((t) => ({
    id: t.id,
    name: t.name,
    hire_date: t.hireDate || null,
    role: t.role,
    weekly_revenue_target: t.weeklyRevenueTarget,
  }));
  const { error } = await supabase.from("technicians").upsert(rows);
  if (error) throw error;
}

// ── weekly entries ────────────────────────────────────────────────────────────

export async function getEntries(): Promise<WeeklyEntry[]> {
  const { data, error } = await supabase
    .from("weekly_entries")
    .select("*")
    .order("week_of", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

export async function getAvailableWeeks(): Promise<string[]> {
  const { data, error } = await supabase
    .from("weekly_entries")
    .select("week_of")
    .order("week_of", { ascending: false });
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.week_of as string)));
}

export async function getEntriesForWeek(weekOf: string): Promise<WeeklyEntry[]> {
  const { data, error } = await supabase
    .from("weekly_entries")
    .select("*")
    .eq("week_of", weekOf);
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

export async function getEntriesForMonth(month: string): Promise<WeeklyEntry[]> {
  const start = `${month}-01`;
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  const end = next.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("weekly_entries")
    .select("*")
    .gte("week_of", start)
    .lt("week_of", end)
    .order("week_of");
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

export async function getEntriesForTechMonth(
  techId: string,
  month: string
): Promise<WeeklyEntry[]> {
  const start = `${month}-01`;
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  const end = next.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("weekly_entries")
    .select("*")
    .eq("tech_id", techId)
    .gte("week_of", start)
    .lt("week_of", end)
    .order("week_of");
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

export async function saveEntry(entry: WeeklyEntry): Promise<void> {
  const { error } = await supabase.from("weekly_entries").upsert({
    id: entry.id,
    tech_id: entry.techId,
    week_of: entry.weekOf,
    jobs_completed: entry.jobsCompleted,
    total_revenue: entry.totalRevenue,
    maintenance_agreements_sold: entry.maintenanceAgreementsSold,
    callback_jobs: entry.callbackJobs,
    first_call_completions: entry.firstCallCompletions,
    late_arrivals: entry.lateArrivals,
    customer_rating_sum: entry.customerRatingSum,
    customer_rating_count: entry.customerRatingCount,
    hours_worked: entry.hoursWorked,
  });
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("weekly_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export function generateId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
