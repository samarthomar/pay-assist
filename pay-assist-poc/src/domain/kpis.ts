import { seeded } from './money';
import type { MorningRun } from './morningRun';

// Results (Stage 6): KPI targets and demo values exactly as in the demo script, Section C (Steps 21-25).
// All KPI values are ILLUSTRATIVE pilot values; anything computed from today's demo run is labelled as such.

export type AreaId = 'self' | 'cx' | 'ai' | 'tech' | 'handoff';
export type Status = 'on' | 'watch' | 'none';

export interface Kpi { name: string; definition: string; target: string; value: string; status: Status }

export const AREAS: { id: AreaId; name: string; weight: number; score: number; comment: string }[] = [
  { id: 'self', name: 'Self-service success', weight: 25, score: 88, comment: 'Strong completion; watch adherence' },
  { id: 'cx', name: 'Customer experience', weight: 20, score: 92, comment: 'High CSAT and low effort' },
  { id: 'ai', name: 'AI agent behaviour', weight: 25, score: 90, comment: 'Calibrate affordability model' },
  { id: 'tech', name: 'Technical performance', weight: 15, score: 97, comment: 'Stable integrations' },
  { id: 'handoff', name: 'Resolution and hand-off', weight: 15, score: 91, comment: 'Context transfer near target' },
];

export const overallScore = () => Math.round(AREAS.reduce((s, a) => s + (a.weight * a.score) / 100, 0));

export const KPIS: Record<AreaId, Kpi[]> = {
  self: [
    { name: 'Notification reach', definition: 'Messages delivered ÷ sent', target: '≥ 97%', value: '98.4%', status: 'on' },
    { name: 'Link click-through', definition: 'Customers opening the link ÷ delivered', target: '≥ 35%', value: '41%', status: 'on' },
    { name: 'Self-service completion', definition: 'Journeys ending in payment or plan without a human ÷ started', target: '≥ 70%', value: '74%', status: 'on' },
    { name: 'Arrangements created', definition: 'Plans created by AI (count)', target: '—', value: '3,812', status: 'none' },
    { name: 'Amount collected / promised', definition: '$ paid today + $ under arrangement', target: '—', value: '$1.9M / $3.4M', status: 'none' },
    { name: 'Plan mix', definition: '% Full / Part+Ext / Instalment / Assist', target: '—', value: '22 / 18 / 41 / 19', status: 'none' },
    { name: 'Arrangement adherence (30 days)', definition: 'Plans with all due payments made ÷ active plans', target: '≥ 80%', value: '77%', status: 'watch' },
    { name: 'Cost to collect', definition: 'Total cost ÷ $ collected', target: '30% lower than baseline', value: '−34%', status: 'on' },
  ],
  cx: [
    { name: 'CSAT', definition: 'Average post-chat rating (1–5)', target: '≥ 4.5', value: '4.6', status: 'on' },
    { name: 'Customer effort score', definition: '% saying “easy to do”', target: '≥ 85%', value: '88%', status: 'on' },
    { name: 'Average journey time', definition: 'Link open to confirmation', target: '≤ 5 min', value: '3m 40s', status: 'on' },
    { name: 'Drop-off rate', definition: 'Sessions abandoned ÷ started', target: '≤ 20%', value: '17%', status: 'on' },
    { name: 'Complaints', definition: 'Complaints linked to Pay Assist per 1,000 sessions', target: '≤ 1', value: '0.6', status: 'on' },
    { name: 'Sentiment shift', definition: '% sessions with sentiment improving start → end', target: '≥ 60%', value: '66%', status: 'on' },
  ],
  ai: [
    { name: 'Recommendation acceptance', definition: 'First recommended plan accepted ÷ plans offered', target: '≥ 60%', value: '63%', status: 'on' },
    { name: 'Affordability accuracy', definition: 'Plans not broken in the first 2 instalments', target: '≥ 85%', value: '82%', status: 'watch' },
    { name: 'Empathy / tone score', definition: 'QA-scored responses meeting tone guidelines', target: '≥ 95%', value: '96%', status: 'on' },
    { name: 'Compliance adherence', definition: 'No balance before verification; hardship info shown', target: '100%', value: '100%', status: 'on' },
    { name: 'Vulnerability detection', definition: 'Vulnerable customers correctly flagged (QA sample)', target: '≥ 95%', value: '94%', status: 'watch' },
    { name: 'Guardrail breaches', definition: 'Plans outside the rules (e.g. extension over 21 days)', target: '0', value: '0', status: 'on' },
    { name: 'Incorrect responses', definition: 'Factually incorrect answers (QA sample)', target: '< 1%', value: '0.4%', status: 'on' },
  ],
  tech: [
    { name: 'Platform availability', definition: 'Uptime during service hours', target: '≥ 99.9%', value: '99.95%', status: 'on' },
    { name: 'AI response time', definition: 'Time to reply (p95)', target: '< 3 sec', value: '1.8 sec', status: 'on' },
    { name: 'Authentication success', definition: 'OTP verified ÷ OTP attempts', target: '≥ 95%', value: '96.2%', status: 'on' },
    { name: 'Payment success', definition: 'Successful transactions ÷ attempts', target: '≥ 97%', value: '97.6%', status: 'on' },
    { name: 'Integration success', definition: 'Successful billing/CRM write-backs', target: '≥ 99.5%', value: '99.7%', status: 'on' },
    { name: 'File processing time', definition: 'Upload to assessment complete', target: '≤ 30 min', value: '18 min', status: 'on' },
  ],
  handoff: [
    { name: 'Containment rate', definition: 'Sessions resolved without a human ÷ total', target: '≥ 70%', value: '74%', status: 'on' },
    { name: 'Escalation rate', definition: 'Sessions transferred to a human', target: '≤ 20%', value: '15%', status: 'on' },
    { name: 'Warm-transfer success', definition: 'Transfers with full context received by the agent', target: '100%', value: '99%', status: 'watch' },
    { name: 'Specialist wait time', definition: 'Escalation to human contact', target: '≤ 2 min chat / 24h callback', value: '1m 50s', status: 'on' },
    { name: 'First contact resolution', definition: 'Resolved without repeat contact in 7 days', target: '≥ 80%', value: '81%', status: 'on' },
    { name: 'Repeat contact rate', definition: 'Same customer re-contacted for the same debt within 30 days', target: '≤ 10%', value: '8%', status: 'on' },
  ],
};

export const belowTarget = () =>
  (Object.keys(KPIS) as AreaId[]).flatMap((a) => KPIS[a].filter((k) => k.status === 'watch').map((k) => ({ area: a, ...k })));

// Today's funnel: the script's illustrative rates applied to today's real AI contact count.
export function funnel(r: MorningRun) {
  const sent = r.decisions.ai;
  const delivered = Math.round(sent * 0.984);
  const clicked = Math.round(delivered * 0.41);
  const verified = Math.round(clicked * 0.962);
  const offered = Math.round(verified * 0.96);
  const done = Math.round(verified * 0.74);
  return [
    ['Sent', sent], ['Delivered', delivered], ['Clicked', clicked], ['Verified', verified], ['Plan offered', offered], ['Plan or payment', done],
  ] as [string, number][];
}

// Overdue ageing before (real, from today's file) and a projected after (illustrative).
export function ageing(r: MorningRun) {
  const buckets: [string, number, number][] = [['1–30 days', 0, 0.82], ['31–60 days', 0, 0.64], ['61–90 days', 0, 0.58], ['90+ days', 0, 0.71]];
  r.rows.forEach(({ overdueCents, days }) => {
    const i = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
    buckets[i][1] += overdueCents;
  });
  return buckets.map(([label, before, keep]) => ({ label, before, after: Math.round(before * keep) }));
}

// A 14-day trend around a KPI value, with a gentle improvement. Deterministic per series.
export function trend(seed: number, end: number, spread: number, drift = 0.3, days = 14) {
  const r = seeded(seed);
  return Array.from({ length: days }, (_, i) => {
    const base = end - drift * spread * ((days - 1 - i) / (days - 1)) * 2;
    return Math.round((base + (r.next() - 0.5) * spread) * 100) / 100;
  });
}

export const PLAN_MIX: [string, number][] = [['Pay in full', 22], ['Part pay + extension', 18], ['Instalments', 41], ['Assist arrangement', 19]];
export const DISPOSITIONS: [string, number][] = [['Arrangement', 38], ['Payment', 31], ['Transfer to Resolution', 12], ['Callback', 8], ['Refused', 6], ['Other', 5]];
export const DROP_OFF: [string, number][] = [['Link opened → verified', 6], ['Verified → balance shown', 2], ['Options → plan chosen', 5], ['Plan → payment', 3], ['Payment → confirmation', 1]];
export const SENTIMENT = { start: [['Negative', 48], ['Neutral', 37], ['Positive', 15]], end: [['Negative', 22], ['Neutral', 30], ['Positive', 48]] } as const;
export const SYSTEMS: [string, string, string][] = [
  ['Billing / CRM', '99.97%', 'Write-backs normal'], ['Payment gateway', '99.92%', '2 timeouts retried'], ['SMS / email', '99.99%', 'Delivered within 40 s'],
  ['OTP service', '99.90%', 'Normal'], ['Pay Assist agents', '99.95%', 'p95 reply 1.8 s'],
];
// Recommended plan (rows) vs plan the customer finally chose (columns), % of AI sessions.
export const REC_MATRIX: { labels: string[]; cells: number[][] } = {
  labels: ['Full', 'Part + ext', 'Instalment', 'Assist'],
  // Diagonal sums to the 63% acceptance KPI; columns sum to the 22/18/41/19 plan mix.
  cells: [[14, 3, 3, 0], [4, 10, 4, 1], [3, 3, 24, 3], [1, 2, 10, 15]],
};
export const VERBATIMS = ['Quick and easy, didn\'t feel judged.', 'Loved that I could pick my payday.', 'Clearer than calling.', 'Took a few minutes, done.', 'Nice not to explain everything twice.'];
