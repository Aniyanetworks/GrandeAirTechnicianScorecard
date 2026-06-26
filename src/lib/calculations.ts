import type { WeeklyEntry, KPIScore, ScoreColor, MonthlyScorecard } from "./types";

export function getScoreColor(score: number): ScoreColor {
  if (score >= 85) return "GREEN";
  if (score >= 70) return "YELLOW";
  return "RED";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// Scores a metric value between 0-100 using a three-tier linear scale.
// below = score at or below the floor (RED line), above = at or above the ceiling (GREEN line)
function tieredScore(value: number, floor: number, ceiling: number, lowerIsBetter = false): number {
  if (lowerIsBetter) {
    if (value <= ceiling) return 100;
    if (value >= floor) return 0;
    return clamp(100 - ((value - ceiling) / (floor - ceiling)) * 100, 0, 100);
  }
  if (value >= ceiling) return 100;
  if (value <= floor) return 0;
  return clamp(((value - floor) / (ceiling - floor)) * 100, 0, 100);
}

export function calcMonthlyKPIs(entries: WeeklyEntry[]): KPIScore[] {
  if (entries.length === 0) return [];

  const totalJobs = entries.reduce((s, e) => s + e.jobsCompleted, 0);
  const totalRevenue = entries.reduce((s, e) => s + e.totalRevenue, 0);
  const totalMAS = entries.reduce((s, e) => s + e.maintenanceAgreementsSold, 0);
  const totalCallbacks = entries.reduce((s, e) => s + e.callbackJobs, 0);
  const totalFCC = entries.reduce((s, e) => s + e.firstCallCompletions, 0);
  const totalLate = entries.reduce((s, e) => s + e.lateArrivals, 0);
  const totalHours = entries.reduce((s, e) => s + e.hoursWorked, 0);
  const totalRatingSum = entries.reduce((s, e) => s + e.customerRatingSum, 0);
  const totalRatingCount = entries.reduce((s, e) => s + e.customerRatingCount, 0);

  const avgRevenuePerJob = totalJobs > 0 ? totalRevenue / totalJobs : 0;
  const masRate = totalJobs > 0 ? (totalMAS / totalJobs) * 100 : 0;
  const callbackRate = totalJobs > 0 ? (totalCallbacks / totalJobs) * 100 : 0;
  const fccRate = totalJobs > 0 ? (totalFCC / totalJobs) * 100 : 0;
  const onTimeRate = totalJobs > 0 ? ((totalJobs - totalLate) / totalJobs) * 100 : 100;
  const jobsPerDay = totalHours > 0 ? totalJobs / (totalHours / 8) : 0;
  const csat = totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0;

  const kpis: KPIScore[] = [
    {
      name: "Avg Revenue / Job",
      value: avgRevenuePerJob,
      score: tieredScore(avgRevenuePerJob, 250, 500),
      weight: 20,
      color: getScoreColor(tieredScore(avgRevenuePerJob, 250, 500)),
      target: "$500",
      actual: `$${avgRevenuePerJob.toFixed(0)}`,
    },
    {
      name: "Maintenance Agreement Rate",
      value: masRate,
      score: tieredScore(masRate, 5, 25),
      weight: 15,
      color: getScoreColor(tieredScore(masRate, 5, 25)),
      target: "25%",
      actual: `${masRate.toFixed(1)}%`,
    },
    {
      name: "First Call Completion",
      value: fccRate,
      score: tieredScore(fccRate, 70, 95),
      weight: 20,
      color: getScoreColor(tieredScore(fccRate, 70, 95)),
      target: "95%",
      actual: `${fccRate.toFixed(1)}%`,
    },
    {
      name: "Callback Rate",
      value: callbackRate,
      score: tieredScore(callbackRate, 0, 8, true),
      weight: 15,
      color: getScoreColor(tieredScore(callbackRate, 0, 8, true)),
      target: "< 3%",
      actual: `${callbackRate.toFixed(1)}%`,
    },
    {
      name: "Customer Satisfaction",
      value: csat,
      score: tieredScore(csat, 3.5, 5.0),
      weight: 15,
      color: getScoreColor(tieredScore(csat, 3.5, 5.0)),
      target: "4.8 / 5",
      actual: csat > 0 ? `${csat.toFixed(2)} / 5` : "N/A",
    },
    {
      name: "On-Time Arrival",
      value: onTimeRate,
      score: tieredScore(onTimeRate, 75, 98),
      weight: 10,
      color: getScoreColor(tieredScore(onTimeRate, 75, 98)),
      target: "98%",
      actual: `${onTimeRate.toFixed(1)}%`,
    },
    {
      name: "Jobs / Day",
      value: jobsPerDay,
      score: tieredScore(jobsPerDay, 2, 5.5),
      weight: 5,
      color: getScoreColor(tieredScore(jobsPerDay, 2, 5.5)),
      target: "5+",
      actual: jobsPerDay.toFixed(1),
    },
  ];

  return kpis;
}

export function calcOverallScore(kpis: KPIScore[]): number {
  if (kpis.length === 0) return 0;
  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  const weighted = kpis.reduce((s, k) => s + k.score * k.weight, 0);
  return Math.round(weighted / totalWeight);
}

export function buildMonthlyScorecard(
  techId: string,
  month: string,
  entries: WeeklyEntry[]
): MonthlyScorecard {
  const kpis = calcMonthlyKPIs(entries);
  const overallScore = calcOverallScore(kpis);
  return {
    techId,
    month,
    overallScore,
    color: getScoreColor(overallScore),
    kpis,
    weeklyEntries: entries,
  };
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getWeekMonday(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function monthLabel(month: string): string {
  return new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function weekLabel(weekOf: string): string {
  const d = new Date(weekOf + "T00:00:00");
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
