// HousecallPro job statuses that mean the job never happened (HCP's Jobs list hides these by default).
export function isCanceled(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase().includes("cancel");
}
