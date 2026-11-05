// Makes Supabase `appointments` / `estimates` agree with HousecallPro.
//
//   node --env-file=.env scripts/backfill-hcp.mjs            dry run: compares, writes nothing
//   node --env-file=.env scripts/backfill-hcp.mjs --apply    backs up the rows it will change, then writes
//
// What it changes (only rows that already have an hcp_*_id):
//   appointments: user_id, user_name (HCP assigned_employees[0]), appointment_status (HCP work_status), subtotal
//   estimates:    user_id, user_name (HCP assigned_employees[0]), estimate_status
//                   = "approved" when any option is approved / pro approved, otherwise HCP work_status
// What it adds: jobs / estimates that exist in HCP but are missing from Supabase.
// What it never touches: phone, email, call_summary_id, audio_link, created_at, rows without an hcp id.

import { mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const { HCP_API_KEY, NEXT_PUBLIC_SUPABASE_URL: SB_URL, SUPABASE_SERVICE_ROLE_KEY: SB_KEY } = process.env;
if (!HCP_API_KEY || !SB_URL || !SB_KEY) throw new Error("HCP_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

const APPROVED = new Set(["approved", "pro approved"]);
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

// ── HCP ──────────────────────────────────────────────────────────────────────
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
  if (!res.ok) throw new Error(`HousecallPro ${res.status} on ${path} page ${page}`);
  return res.json();
}
async function hcpAll(path, key) {
  const first = await hcpPage(path, 1);
  const out = [...first[key]];
  for (let p = 2; p <= first.total_pages; p += 4) {
    const pages = Array.from({ length: Math.min(4, first.total_pages - p + 1) }, (_, i) => p + i);
    for (const r of await Promise.all(pages.map(n => hcpPage(path, n)))) out.push(...r[key]);
    process.stdout.write(`\r  ${path}: ${out.length}/${first.total_items}   `);
  }
  console.log();
  return out;
}

// ── Supabase ─────────────────────────────────────────────────────────────────
async function sbAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?select=${cols}&order=created_at.desc&limit=1000&offset=${from}`, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
    const d = await res.json();
    out.push(...d);
    if (d.length < 1000) break;
  }
  return out;
}
async function pool(items, size, fn) {
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
      if (++done % 200 === 0) process.stdout.write(`\r  ${done}/${items.length}   `);
    }
  }));
  console.log();
}

// ── helpers ──────────────────────────────────────────────────────────────────
const fullName = p => (p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : null) || null;
const norm = s => (String(s ?? "").toLowerCase().trim() || "pending");
const e164 = n => { const d = String(n ?? "").replace(/\D/g, ""); return d.length === 10 ? `+1${d}` : d.length === 11 && d[0] === "1" ? `+${d}` : null; };
const blank = s => (s == null || String(s).trim() === "" ? null : String(s).trim());
const same = (a, b) => (a ?? null) === (b ?? null);

function jobFields(j) {
  const emp = j.assigned_employees?.[0];
  return { user_id: emp?.id ?? null, user_name: fullName(emp), appointment_status: norm(j.work_status), subtotal: j.subtotal ?? 0 };
}
function estFields(e) {
  const emp = e.assigned_employees?.[0];
  const won = (e.options ?? []).some(o => APPROVED.has(o.approval_status));
  return { user_id: emp?.id ?? null, user_name: fullName(emp), estimate_status: won ? "approved" : norm(e.work_status) };
}

// ── run ──────────────────────────────────────────────────────────────────────
console.log(APPLY ? "APPLY MODE" : "DRY RUN (nothing is written)");
const hJobs = await hcpAll("jobs", "jobs");
const hEsts = await hcpAll("estimates", "estimates");
const sJobs = await sbAll("appointments", "id,hcp_job_id,user_id,user_name,appointment_status,subtotal");
const sEsts = await sbAll("estimates", "id,hcp_estimate_id,user_id,user_name,estimate_status");

const plans = [
  { table: "appointments", idCol: "hcp_job_id", hcp: hJobs, sb: sJobs, fields: jobFields, cols: ["user_id", "user_name", "appointment_status", "subtotal"] },
  { table: "estimates", idCol: "hcp_estimate_id", hcp: hEsts, sb: sEsts, fields: estFields, cols: ["user_id", "user_name", "estimate_status"] },
];

const work = [];
for (const p of plans) {
  const byHcp = new Map(p.hcp.map(x => [x.id, x]));
  const have = new Set();
  const updates = [];
  const perCol = Object.fromEntries(p.cols.map(c => [c, 0]));
  for (const row of p.sb) {
    const h = row[p.idCol] && byHcp.get(row[p.idCol]);
    if (!h) continue;
    have.add(row[p.idCol]);
    const want = p.fields(h), patch = {}, old = {};
    for (const c of p.cols) {
      const cur = c === "user_name" ? blank(row[c]) : row[c];
      if (!same(cur, want[c])) { patch[c] = want[c]; old[c] = row[c]; perCol[c]++; }
    }
    if (Object.keys(patch).length) updates.push({ id: row.id, patch, old });
  }
  const missing = p.hcp.filter(x => !have.has(x.id));
  console.log(`\n${p.table}: supabase ${p.sb.length} rows, HCP ${p.hcp.length}`);
  console.log(`  rows to update: ${updates.length}  (${p.cols.map(c => `${c}: ${perCol[c]}`).join(", ")})`);
  console.log(`  rows to add (in HCP, missing in Supabase): ${missing.length}`);
  for (const u of updates.slice(0, 3)) console.log("  e.g.", JSON.stringify({ old: u.old, new: u.patch }));
  work.push({ ...p, updates, missing });
}

if (!APPLY) { console.log("\nDry run finished. Re-run with --apply to write."); process.exit(0); }

// backup first
mkdirSync("scripts/backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = `scripts/backups/backfill-${stamp}.json`;
writeFileSync(backupFile, JSON.stringify(work.map(w => ({ table: w.table, rows: w.updates.map(u => ({ id: u.id, ...u.old })) })), null, 1));
console.log(`\nBackup of the old values written to ${backupFile}`);

for (const w of work) {
  console.log(`Updating ${w.table}…`);
  await pool(w.updates, 8, async u => {
    const res = await fetch(`${SB_URL}/rest/v1/${w.table}?id=eq.${u.id}`, {
      method: "PATCH", headers: { ...sbHeaders, Prefer: "return=minimal" }, body: JSON.stringify(u.patch),
    });
    if (!res.ok) throw new Error(`PATCH ${w.table} ${u.id}: ${res.status} ${await res.text()}`);
  });

  if (w.missing.length) {
    console.log(`Adding ${w.missing.length} missing ${w.table}…`);
    const rows = w.missing.map(h => {
      const c = h.customer ?? {};
      const base = {
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
        phone: e164(c.mobile_number ?? c.home_number ?? c.work_number),
        email: c.email || null,
        created_at: h.created_at, call_date: h.created_at,
        ...w.fields(h),
      };
      return w.table === "appointments"
        ? { ...base, hcp_job_id: h.id }
        : { ...base, hcp_estimate_id: h.id, total_amount: h.options?.[0]?.total_amount ?? 0 };
    });
    for (let i = 0; i < rows.length; i += 200) {
      const res = await fetch(`${SB_URL}/rest/v1/${w.table}`, { method: "POST", headers: { ...sbHeaders, Prefer: "return=minimal" }, body: JSON.stringify(rows.slice(i, i + 200)) });
      if (!res.ok) throw new Error(`INSERT ${w.table}: ${res.status} ${await res.text()}`);
    }
  }
}
console.log("\nDone. Backup:", backupFile);
