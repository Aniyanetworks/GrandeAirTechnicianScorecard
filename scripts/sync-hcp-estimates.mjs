// Copies HousecallPro estimates (all options + what was actually paid on the chosen one) into Supabase `hcp_estimates`.
// Paid = succeeded invoice payments on the job created from an option (job.original_estimate_id = option id).
//
//   node --env-file=.env scripts/sync-hcp-estimates.mjs            sync
//   node --env-file=.env scripts/sync-hcp-estimates.mjs --dry-run  fetch + summarise, write nothing
//
// Needs HCP_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only, never NEXT_PUBLIC_).

const PAGE_SIZE = 100;
const BATCH = 4;

const dryRun = process.argv.includes("--dry-run");
const { HCP_API_KEY, NEXT_PUBLIC_SUPABASE_URL: SB_URL, SUPABASE_SERVICE_ROLE_KEY: SB_KEY } = process.env;

if (!HCP_API_KEY) throw new Error("HCP_API_KEY is not set");
if (!dryRun && (!SB_URL || !SB_KEY)) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");

// Last year's January is the earliest date any comparison needs; go back a further 180 days so
// estimates created earlier but approved later are still included.
const cutoff = new Date(new Date().getFullYear() - 1, 0, 1).getTime() - 180 * 86_400_000;

async function hcpPage(path, page, attempt = 0) {
  const res = await fetch(
    `https://api.housecallpro.com/${path}?page_size=${PAGE_SIZE}&page=${page}&sort_direction=desc`,
    { headers: { Authorization: `Token ${HCP_API_KEY}`, Accept: "application/json" } },
  );
  if (res.status === 429 && attempt < 4) {
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    return hcpPage(path, page, attempt + 1);
  }
  if (!res.ok) throw new Error(`HousecallPro ${res.status} on ${path} page ${page}`);
  return res.json();
}

// Fetch every page of a list endpoint. `stopWhen(items)` lets newest-first lists stop early.
async function fetchAll(path, key, stopWhen = () => false) {
  const first = await hcpPage(path, 1);
  const totalPages = first.total_pages ?? 1;
  const out = [...first[key]];
  for (let p = 2; p <= totalPages && !stopWhen(out); p += BATCH) {
    const pages = Array.from({ length: Math.min(BATCH, totalPages - p + 1) }, (_, i) => p + i);
    for (const r of await Promise.all(pages.map(n => hcpPage(path, n)))) out.push(...r[key]);
    process.stdout.write(`  ${path}: ${out.length}/${first.total_items}   `);
  }
  console.log();
  return out;
}

const oldest = items => new Date(items[items.length - 1].created_at).getTime() < cutoff;

const estimates = (await fetchAll("estimates", "estimates", oldest)).filter(e => new Date(e.created_at).getTime() >= cutoff);
const jobs      = await fetchAll("jobs", "jobs", oldest);
const invoices  = await fetchAll("invoices", "invoices");

// A job created from an estimate carries the chosen option's id in original_estimate_id.
const jobByOption = new Map();
for (const j of jobs) {
  if (j.original_estimate_id) jobByOption.set(j.original_estimate_id, j.id);
  for (const u of j.original_estimate_uuids ?? []) jobByOption.set(u, j.id);
}
// Money paid per job, dated by each payment (cents -> dollars)
const paymentsByJob = new Map();
for (const inv of invoices) {
  for (const pay of inv.payments ?? []) {
    if (pay.status !== "succeeded" || !pay.paid_at) continue;
    if (!paymentsByJob.has(inv.job_id)) paymentsByJob.set(inv.job_id, []);
    paymentsByJob.get(inv.job_id).push({ amount: (pay.amount ?? 0) / 100, paidAt: pay.paid_at });
  }
}

const rows = estimates.map(e => {
  const emp = e.assigned_employees?.[0];
  const options = (e.options ?? []).map(o => ({
    name: String(o.name ?? "").trim() || o.option_number || "Option",
    amount: (o.total_amount ?? 0) / 100,
    payments: paymentsByJob.get(jobByOption.get(o.id)) ?? [],
  }));
  return {
    id: e.id,
    number: String(e.estimate_number ?? ""),
    customer: [e.customer?.first_name, e.customer?.last_name].filter(Boolean).join(" ") || null,
    sent_by: emp ? [emp.first_name, emp.last_name].filter(Boolean).join(" ") : null,
    created_at: e.created_at,
    options,
    has_won: options.some(o => o.payments.length > 0),
    synced_at: new Date().toISOString(),
  };
});
console.log(`Kept ${rows.length} estimates since ${new Date(cutoff).toISOString().slice(0, 10)}; ${rows.filter(r => r.has_won).length} have a paid option`);

if (dryRun) {
  const today = new Date().toDateString();
  let paidToday = 0;
  for (const r of rows) for (const o of r.options) for (const p of o.payments)
    if (new Date(p.paidAt).toDateString() === today) paidToday += p.amount;
  console.log(`Dry run: paid today on estimate jobs = $${paidToday.toFixed(2)}. Nothing written.`);
  process.exit(0);
}

for (let i = 0; i < rows.length; i += 500) {
  const res = await fetch(`${SB_URL}/rest/v1/hcp_estimates?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows.slice(i, i + 500)),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  process.stdout.write(`\r  upserted ${Math.min(i + 500, rows.length)}/${rows.length}`);
}
console.log("\nDone.");
