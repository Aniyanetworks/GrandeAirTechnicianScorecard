export type ScoreColor = "GREEN" | "YELLOW" | "RED";

export interface WeeklyEntry {
  id: string;
  techId: string;
  weekOf: string; // ISO date string for Monday
  jobsCompleted: number;
  totalRevenue: number;
  maintenanceAgreementsSold: number;
  callbackJobs: number;
  firstCallCompletions: number;
  lateArrivals: number;
  customerRatingSum: number; // sum of all ratings
  customerRatingCount: number; // number of rated jobs
  hoursWorked: number;
}

export interface Technician {
  id: string;
  name: string;
  hireDate: string;
  role: string;
  weeklyRevenueTarget: number;
}

export interface KPIScore {
  name: string;
  value: number;
  score: number; // 0-100
  weight: number;
  color: ScoreColor;
  target: string;
  actual: string;
}

export interface MonthlyScorecard {
  techId: string;
  month: string; // "YYYY-MM"
  overallScore: number;
  color: ScoreColor;
  kpis: KPIScore[];
  weeklyEntries: WeeklyEntry[];
}

export interface QuarterlyScorecard {
  techId: string;
  quarter: string; // "YYYY-Q1"
  overallScore: number;
  color: ScoreColor;
  monthlyBreakdown: { month: string; score: number; color: ScoreColor }[];
}

export interface ManagerScorecard {
  month: string;
  overallScore: number;
  color: ScoreColor;
  teamAvgScore: number;
  teamRevenueGoalPct: number;
  greenTechCount: number;
  yellowTechCount: number;
  redTechCount: number;
  coachingSessionsHeld: number;
  maintenanceAgreementTeamRate: number;
  firstCallCompletionTeamRate: number;
  customerSatisfactionTeamAvg: number;
}
