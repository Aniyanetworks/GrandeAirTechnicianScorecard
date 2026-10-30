-- One row per HousecallPro estimate. Each estimate holds several options (e.g. $1,000 / $2,000 / $3,000);
-- the client approves one. `options` keeps every option so the dashboard can show what was sent vs. chosen.
--
-- options[] item: { "name": text, "amount": dollars, "approval": text|null, "approvedAt": iso|null }
-- Run this once in the Supabase SQL editor.

create table if not exists public.hcp_estimates (
  id          text primary key,              -- HCP estimate id (csr_...)
  number      text,
  customer    text,
  sent_by     text,                          -- assigned_employees[0]
  created_at  timestamptz not null,
  options     jsonb       not null default '[]'::jsonb,
  has_won     boolean     not null default false,
  synced_at   timestamptz not null default now()
);

create index if not exists hcp_estimates_won_idx on public.hcp_estimates (has_won, created_at desc);

alter table public.hcp_estimates enable row level security;

-- The dashboard reads with the anon key (same as the other tables). Writes use the service-role key only.
drop policy if exists "hcp_estimates anon read" on public.hcp_estimates;
create policy "hcp_estimates anon read" on public.hcp_estimates for select using (true);
