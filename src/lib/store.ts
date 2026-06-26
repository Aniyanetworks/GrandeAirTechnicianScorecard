"use client";

import type { Technician, WeeklyEntry } from "./types";

const TECHS_KEY = "grande_air_technicians";
const ENTRIES_KEY = "grande_air_weekly_entries";

const defaultTechs: Technician[] = [
  { id: "t1", name: "Marcus Rivera", hireDate: "2022-03-15", role: "Lead Technician", weeklyRevenueTarget: 5000 },
  { id: "t2", name: "Dylan Torres", hireDate: "2023-01-10", role: "HVAC Technician", weeklyRevenueTarget: 4000 },
  { id: "t3", name: "Cody Nguyen", hireDate: "2023-07-22", role: "HVAC Technician", weeklyRevenueTarget: 3500 },
  { id: "t4", name: "Jake Simmons", hireDate: "2024-02-05", role: "Junior Technician", weeklyRevenueTarget: 3000 },
];

// Seed 12 weeks of realistic data so the dashboard is populated on first load
function seedEntries(): WeeklyEntry[] {
  const weeks: string[] = [];
  const base = new Date("2026-03-30"); // Monday
  for (let i = 0; i < 12; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }

  const entries: WeeklyEntry[] = [];
  const techProfiles = [
    { id: "t1", revenueBase: 520, masBase: 0.28, fccBase: 0.94, cbBase: 0.02, lateBase: 0.03, csatBase: 4.85, jobsBase: 22 },
    { id: "t2", revenueBase: 440, masBase: 0.18, fccBase: 0.88, cbBase: 0.04, lateBase: 0.06, csatBase: 4.6,  jobsBase: 19 },
    { id: "t3", revenueBase: 380, masBase: 0.12, fccBase: 0.82, cbBase: 0.07, lateBase: 0.10, csatBase: 4.3,  jobsBase: 17 },
    { id: "t4", revenueBase: 310, masBase: 0.08, fccBase: 0.76, cbBase: 0.10, lateBase: 0.14, csatBase: 4.0,  jobsBase: 14 },
  ];

  let idx = 0;
  for (const week of weeks) {
    for (const p of techProfiles) {
      const jitter = () => 0.85 + Math.random() * 0.3;
      const jobs = Math.round(p.jobsBase * jitter());
      const revenue = Math.round(p.revenueBase * jobs * jitter());
      const mas = Math.round(p.masBase * jobs * jitter());
      const fcc = Math.round(p.fccBase * jobs);
      const cb = Math.round(p.cbBase * jobs);
      const late = Math.round(p.lateBase * jobs);
      const ratingCount = Math.max(1, Math.round(jobs * 0.6));
      const ratingSum = parseFloat((p.csatBase * ratingCount * jitter()).toFixed(1));
      entries.push({
        id: `seed-${idx++}`,
        techId: p.id,
        weekOf: week,
        jobsCompleted: jobs,
        totalRevenue: revenue,
        maintenanceAgreementsSold: mas,
        callbackJobs: cb,
        firstCallCompletions: fcc,
        lateArrivals: late,
        customerRatingSum: ratingSum,
        customerRatingCount: ratingCount,
        hoursWorked: jobs * 1.8,
      });
    }
  }
  return entries;
}

export function getTechnicians(): Technician[] {
  if (typeof window === "undefined") return defaultTechs;
  try {
    const raw = localStorage.getItem(TECHS_KEY);
    return raw ? JSON.parse(raw) : defaultTechs;
  } catch {
    return defaultTechs;
  }
}

export function saveTechnicians(techs: Technician[]): void {
  localStorage.setItem(TECHS_KEY, JSON.stringify(techs));
}

export function getEntries(): WeeklyEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (raw) return JSON.parse(raw);
    const seeded = seedEntries();
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

export function saveEntry(entry: WeeklyEntry): void {
  const entries = getEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function deleteEntry(id: string): void {
  const entries = getEntries().filter((e) => e.id !== id);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function getEntriesForTechMonth(techId: string, month: string): WeeklyEntry[] {
  return getEntries().filter((e) => e.techId === techId && e.weekOf.startsWith(month));
}

export function getEntriesForMonth(month: string): WeeklyEntry[] {
  return getEntries().filter((e) => e.weekOf.startsWith(month));
}

export function generateId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
