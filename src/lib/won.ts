// "Won" = paid. A client is sent several options (e.g. $1,000 / $2,000 / $3,000) and takes one;
// that option becomes a job with an invoice. Only money actually paid on the chosen option counts,
// dated by the payment, never the sum of the options that were offered.
export interface Payment {
  amount: number; // dollars
  paidAt: string; // ISO
}

export interface WonOption {
  name: string;
  amount: number;      // quoted price in dollars
  payments: Payment[]; // succeeded payments on the job created from this option
}

export interface WonEstimate {
  id: string;
  number: string;
  customer: string;
  sentBy: string | null;
  createdAt: string;
  options: WonOption[];
}

export function isWonOption(o: WonOption): boolean {
  return o.payments.length > 0;
}

export function wonOptions(e: WonEstimate): WonOption[] {
  return e.options.filter(isWonOption);
}

export function paymentsBetween(o: WonOption, start: Date, end: Date): Payment[] {
  return o.payments.filter(p => { const t = new Date(p.paidAt); return t >= start && t < end; });
}
