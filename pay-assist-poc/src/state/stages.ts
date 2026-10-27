// The demo is navigated as a journey through five stages plus results,
// rather than as numbered tabs.
export type StageId = 'assess' | 'engage' | 'resolve' | 'protect' | 'sustain' | 'results';

export type AgentId =
  | 'orchestrator' | 'intake' | 'assessment' | 'engagement' | 'payassist'
  | 'plan' | 'guardian' | 'handoff' | 'sustain' | 'insights';

export const AGENTS: { id: AgentId; name: string; job: string }[] = [
  { id: 'orchestrator', name: 'Orchestrator', job: 'Plans the run and routes work' },
  { id: 'intake', name: 'Intake', job: 'Validates the daily file' },
  { id: 'assessment', name: 'Assessment', job: 'Segments and scores affordability' },
  { id: 'engagement', name: 'Engagement', job: 'Picks channel, time and message' },
  { id: 'payassist', name: 'Pay Assist', job: 'Talks with the customer' },
  { id: 'plan', name: 'Plan', job: 'Builds affordable plans' },
  { id: 'guardian', name: 'Guardian', job: 'Checks rules and vulnerability' },
  { id: 'handoff', name: 'Handoff', job: 'Briefs humans, Copilot' },
  { id: 'sustain', name: 'Sustain', job: 'Keeps plans on track' },
  { id: 'insights', name: 'Insights', job: 'Measures results' },
];

export interface StageDef {
  id: StageId;
  n: number;
  name: string;
  what: string;
  title: string;
  lede: string;
  agents: AgentId[];
}

export const STAGES: StageDef[] = [
  {
    id: 'assess', n: 1, name: 'Assess', what: 'Morning run',
    title: 'Every overdue account assessed before 8 am',
    lede: 'The daily overdue file arrives. Agents validate it, apply AGL rules, score affordability and decide for every account: AI contact, human contact or do not contact, each with a plain-English reason.',
    agents: ['orchestrator', 'intake', 'assessment', 'plan', 'guardian', 'engagement', 'handoff'],
  },
  {
    id: 'engage', n: 2, name: 'Engage', what: 'SMS, email, login',
    title: 'The right message, at the right time, with no balance on show',
    lede: 'Customers receive an SMS and an email within permitted hours. The balance is only revealed after a secure date-of-birth and OTP check.',
    agents: ['engagement', 'guardian'],
  },
  {
    id: 'resolve', n: 3, name: 'Resolve', what: 'Pay Assist chat',
    title: 'A plan built around payday, not a fixed menu',
    lede: 'Pay Assist listens first, then builds a plan around the customer\'s pay cycle and what they can comfortably pay. Every amount comes from the plan calculator and is checked by the Guardian.',
    agents: ['payassist', 'plan', 'guardian'],
  },
  {
    id: 'protect', n: 4, name: 'Protect', what: 'Humans in the loop',
    title: 'Sensitive cases go to people, fully briefed',
    lede: 'Life support, distress, family violence and balances of $2,000 or more go to specialists. The AI prepares the case card and drafts the plan; the specialist decides.',
    agents: ['guardian', 'handoff'],
  },
  {
    id: 'sustain', n: 5, name: 'Sustain', what: 'Keep plans on track',
    title: 'Plans rescued before they break',
    lede: 'The Sustain agent reminds customers before payday, spots failed payments within hours and adjusts the plan within the rules.',
    agents: ['sustain', 'plan', 'guardian'],
  },
  {
    id: 'results', n: 6, name: 'Results', what: 'Business value',
    title: 'What Pay Assist delivers',
    lede: 'Self-service success, customer experience, AI behaviour, technical performance and hand-off, in one scorecard. All values are illustrative.',
    agents: ['insights'],
  },
];
