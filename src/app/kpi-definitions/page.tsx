const kpis = [
  {
    name: "Average Revenue / Job",
    weight: "20%",
    formula: "Total Revenue ÷ Jobs Completed",
    target: "$500",
    green: "≥ $450",
    yellow: "$350–$449",
    red: "< $350",
    why: "Revenue per job is your single biggest lever for hitting the $2.3M goal. It reflects upsell skill, parts pricing accuracy, and service thoroughness.",
    coaching: [
      "Review job notes — is tech proposing system health upgrades or add-ons?",
      "Role-play upsell conversations in the shop.",
      "Track average ticket weekly so the tech can self-correct.",
    ],
  },
  {
    name: "Maintenance Agreement Rate",
    weight: "15%",
    formula: "MAs Sold ÷ Jobs Completed × 100",
    target: "25%",
    green: "≥ 20%",
    yellow: "10–19%",
    red: "< 10%",
    why: "MAs create predictable recurring revenue and lock in future replacement jobs. Every MA sold is worth $150–300/yr in guaranteed return visits.",
    coaching: [
      "Script: 'While I'm here I noticed your system is 8 years old — our MA covers two tune-ups and gives you priority scheduling.'",
      "Track # of conversations, not just conversions.",
      "Share top-performer scripts at the weekly team huddle.",
    ],
  },
  {
    name: "First-Call Completion Rate",
    weight: "20%",
    formula: "Jobs Completed on First Visit ÷ Total Jobs × 100",
    target: "95%",
    green: "≥ 92%",
    yellow: "80–91%",
    red: "< 80%",
    why: "Every return trip costs ~$75 in truck + labor overhead and destroys customer satisfaction. High FCC means the tech diagnoses right and carries the right parts.",
    coaching: [
      "Review which job types fail most — is it parts stock or diagnosis?",
      "Add common fail-parts to the truck inventory.",
      "Debrief every non-completion: what info was missing before the call?",
    ],
  },
  {
    name: "Callback Rate",
    weight: "15%",
    formula: "Callbacks Within 30 Days ÷ Jobs Completed × 100",
    target: "< 3%",
    green: "< 3%",
    yellow: "3–6%",
    red: "> 6%",
    why: "Callbacks are free labor — the company eats the cost. They also signal installation or diagnostic errors that can hurt reviews and referrals.",
    coaching: [
      "Review every callback job: was it a parts failure, misdiagnosis, or customer error?",
      "Introduce a pre-departure checklist (system test + customer walkthrough).",
      "Track callback root causes weekly.",
    ],
  },
  {
    name: "Customer Satisfaction Score",
    weight: "15%",
    formula: "Sum of Star Ratings ÷ Number of Ratings",
    target: "4.8 / 5.0",
    green: "≥ 4.7",
    yellow: "4.3–4.69",
    red: "< 4.3",
    why: "CSAT drives Google reviews, referrals, and repeat business. A 1-star drop in Google rating can reduce call volume 5–9%. It's the tech's personal brand.",
    coaching: [
      "Listen to tech's customer communication tone — is it confident and friendly?",
      "Script the close: recap what was done, show the before/after, ask for a review.",
      "Low scores often trace to lateness or mess — address those first.",
    ],
  },
  {
    name: "On-Time Arrival Rate",
    weight: "10%",
    formula: "(Jobs Completed − Late Arrivals) ÷ Jobs Completed × 100",
    target: "98%",
    green: "≥ 95%",
    yellow: "85–94%",
    red: "< 85%",
    why: "Customers in Texas take on a workday off for HVAC service. A late tech signals disrespect and is the #1 driver of 1 and 2-star reviews.",
    coaching: [
      "Check dispatch — is routing optimized? Are jobs too tightly stacked?",
      "Require techs to call 30 min before ETA if running late.",
      "Track late reasons: traffic, previous job overrun, or personal tardiness?",
    ],
  },
  {
    name: "Jobs / Day",
    weight: "5%",
    formula: "Jobs Completed ÷ (Hours Worked ÷ 8)",
    target: "5+ per day",
    green: "≥ 5.0",
    yellow: "3.5–4.9",
    red: "< 3.5",
    why: "Productivity sets the ceiling on revenue. A tech doing 3 jobs/day leaves 2 billable slots on the table — roughly $900/day in missed revenue.",
    coaching: [
      "Ride-along to observe: is time lost on drive, paperwork, or parts hunting?",
      "Optimize truck stock so no mid-day supply runs.",
      "Review dispatch — are job types matched to tech skill level?",
    ],
  },
];

const colorStyle: Record<string, string> = {
  GREEN:  "bg-emerald-100 text-emerald-800 border-emerald-200",
  YELLOW: "bg-amber-100 text-amber-800 border-amber-200",
  RED:    "bg-red-100 text-red-700 border-red-200",
};

export default function KPIDefinitionsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black text-brand-navy">KPI Definitions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every KPI: formula, why it matters, targets, and coaching actions</p>
      </div>

      {/* Weight summary */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">Score Weights</h2>
        <div className="flex flex-wrap gap-2">
          {kpis.map((k) => (
            <div key={k.name} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold text-gray-700">{k.name}</span>
              <span className="text-xs font-bold text-brand-teal-dk bg-brand-teal-lt px-2 py-0.5 rounded-full border border-brand-teal/30">{k.weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="space-y-4">
        {kpis.map((kpi) => (
          <div key={kpi.name} className="card overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-gray-900">{kpi.name}</h2>
                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">{kpi.weight}</span>
              </div>
              <code className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded-lg hidden sm:block">
                {kpi.formula}
              </code>
            </div>
            <div className="p-6 space-y-5">
              {/* Targets */}
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Target", value: kpi.target, style: "bg-brand-teal-lt text-brand-teal-dk border-brand-teal/30" },
                  { label: "GREEN",  value: kpi.green,  style: colorStyle.GREEN },
                  { label: "YELLOW", value: kpi.yellow, style: colorStyle.YELLOW },
                  { label: "RED",    value: kpi.red,    style: colorStyle.RED },
                ].map((t) => (
                  <div key={t.label} className={`border rounded-lg px-4 py-2 text-center ${t.style}`}>
                    <p className="text-xs font-semibold opacity-70">{t.label}</p>
                    <p className="text-sm font-bold mt-0.5">{t.value}</p>
                  </div>
                ))}
              </div>

              {/* Formula (mobile) */}
              <div className="sm:hidden">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Formula</p>
                <code className="text-sm text-gray-700">{kpi.formula}</code>
              </div>

              {/* Why it matters */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Why It Matters</p>
                <p className="text-sm text-gray-700 leading-relaxed">{kpi.why}</p>
              </div>

              {/* Coaching actions */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Coaching Actions</p>
                <ul className="space-y-1.5">
                  {kpi.coaching.map((c, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-brand-orange text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Score bands reminder */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-800 mb-3">Score Bands</h2>
        <div className="space-y-3">
          {[
            { range: "85–100", color: "GREEN",  desc: "Exceeding expectations. Reward, reinforce, consider for lead tech.", style: colorStyle.GREEN },
            { range: "70–84",  color: "YELLOW", desc: "Needs improvement. Targeted coaching on the 1–2 weakest KPIs.",     style: colorStyle.YELLOW },
            { range: "0–69",   color: "RED",    desc: "Immediate coaching required. Weekly check-ins until back above 70.", style: colorStyle.RED },
          ].map((b) => (
            <div key={b.color} className={`flex items-start gap-4 border rounded-xl px-4 py-3 ${b.style}`}>
              <span className="text-sm font-black w-16 flex-shrink-0">{b.range}</span>
              <span className="text-sm font-bold w-16 flex-shrink-0">{b.color}</span>
              <span className="text-sm">{b.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
