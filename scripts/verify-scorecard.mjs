// Read-only. Compares one technician's month on the dashboard (Supabase, same rules as the Scorecard page)
// with HousecallPro (live API) so the two can be shown side by side.
//
//   node --env-file=.env scripts/verify-scorecard.mjs "Bryan Candia" 2026-09
//
// Uses only the read-only anon key; it never writes.

const [NAME = "Bryan Candia", MONTH = "2026-09"] = process.argv.slice(2);
const { HCP_API_KEY, NEXT_PUBLIC_SUPABASE_URL: SB_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: SB_KEY } = process.env;
const TZ = "America/Chicago";

const monthOf = iso => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ }).slice(0, 7);
const canceled = s => (s ?? "").toLowerCase().includes("cancel");
const DONE = new Set(["complete unrated", "complete rated", "complete", "completed", "done", "finished", "closed", "unrated"]);
const money = n => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function hcpPage(path, page, attempt = 0) {
  let res;
  try {
    res = await fetch(`https://api.housecallpro.com/${path}?page_size=100&page=${page}&sort_direction=desc`,
      { headers: { Authorization: `Token ${HCP_API_KEY}`, Accept: "application/json" } });
  } catch (e) {
    if (attempt >= 5) throw e;
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    return hcpPage(path, page, attempt + 1);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 5) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); return hcpPage(path, page, attempt + 1); }
  if (!res.ok) throw new Error(`HousecallPro ${res.status}`);
  return res.json();
}
async function hcpMonth(path, key) {
  const out = [];
  for (let p = 1; ; p += 4) {
    const rs = await Promise.all([0, 1, 2, 3].map(i => hcpPage(path, p + i)));
    let stop = false;
    for (const r of rs) {
      out.push(...r[key]);
      if (!r[key].length || monthOf(r[key][r[key].length - 1].created_at) < MONTH) stop = true;
    }
    if (stop) break;
  }
  return out.filter(x => monthOf(x.created_at) === MONTH);
}
async function sbMonth(table, cols, idCol) {
  const [y, m] = MONTH.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const out = [];
  for (let from = 0; ; from += 1000) {
    const url = `${SB_URL}/rest/v1/${table}?select=${cols}&${idCol}=not.is.null&created_at=gte.${MONTH}-01T00:00:00-06:00&created_at=lt.${next}-01T00:00:00-06:00&limit=1000&offset=${from}`;
    const d = await (await fetch(url, { headers: { apikey: SB_KEY } })).json();
    out.push(...d);
    if (d.length < 1000) break;
  }
  // exact month boundary the dashboard uses: the date string as stored
  return out.filter(r => r.created_at.slice(0, 7) === MONTH);
}
const empName = x => { const e = x.assigned_employees?.[0]; return e ? [e.first_name, e.last_name].filter(Boolean).join(" ") : null; };

const [hJobsAll, hEstsAll, sJobsAll, sEstsAll] = await Promise.all([
  hcpMonth("jobs", "jobs"), hcpMonth("estimates", "estimates"),
  sbMonth("appointments", "hcp_job_id,appointment_status,subtotal,user_name,created_at", "hcp_job_id"),
  sbMonth("estimates", "hcp_estimate_id,estimate_status,user_name,created_at", "hcp_estimate_id"),
]);

const hJobs = hJobsAll.filter(j => empName(j) === NAME && !canceled(j.work_status));
const hEsts = hEstsAll.filter(e => empName(e) === NAME);
const sJobs = sJobsAll.filter(j => j.user_name === NAME && !canceled(j.appointment_status));
const sEsts = sEstsAll.filter(e => e.user_name === NAME);

const hWon = hEsts.filter(e => (e.options ?? []).some(o => ["approved", "pro approved"].includes(o.approval_status))).length;
const sWon = sEsts.filter(e => e.estimate_status === "approved").length;
const hRev = hJobs.reduce((s, j) => s + (j.subtotal ?? 0), 0) / 100;
const sRev = sJobs.reduce((s, j) => s + (j.subtotal ?? 0), 0) / 100;
const hDone = hJobs.filter(j => DONE.has((j.work_status ?? "").toLowerCase().trim())).length;
const sDone = sJobs.filter(j => DONE.has((j.appointment_status ?? "").toLowerCase().trim())).length;

const rows = [
  ["Service calls (jobs, not canceled)", sJobs.length, hJobs.length],
  ["Jobs completed", sDone, hDone],
  ["Total revenue (job subtotal)", money(sRev), money(hRev)],
  ["Average ticket", money(sDone ? sRev / sDone : 0), money(hDone ? hRev / hDone : 0)],
  ["Estimates created", sEsts.length, hEsts.length],
  ["Estimates sold (an option approved)", sWon, hWon],
];
console.log(`\n${NAME} — ${MONTH}\n`);
console.log("KPI".padEnd(40), "Dashboard".padEnd(14), "HCP".padEnd(14), "");
for (const [k, a, b] of rows) console.log(k.padEnd(40), String(a).padEnd(14), String(b).padEnd(14), String(a) === String(b) ? "MATCH" : "DIFFERENT");
console.log(`\nSame in HCP: Jobs page → Created between ${MONTH}-01 and month end, Employee = ${NAME} (the default view hides canceled jobs).`);
