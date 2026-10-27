// The rule book: every rule code shown in the demo, in plain words, with an example and where it appears.
// Sources: AGL's demo script (business rules D1, escalation matrix D2), our BRD, or proposed by us.

export type RuleSource = 'AGL demo script' | 'Pay Assist design (BRD)' | 'Proposed, to confirm with AGL';

export interface Rule {
  id: string;
  name: string;
  simple: string;
  example: string;
  where: string;
  source: RuleSource;
}

export interface RuleGroup { title: string; intro: string; rules: Rule[] }

export const RULE_GROUPS: RuleGroup[] = [
  {
    title: 'Who the AI may contact',
    intro: 'Checked every morning for every overdue customer, before anyone is contacted.',
    rules: [
      { id: 'BR-T01', name: 'AI can help', simple: 'Owes less than $2,000 and has no special flags, so the AI may contact them and offer plans.', example: 'Sarah owes $847.50, so the AI contacts her.', where: 'Screen 1: decision "AI contact"', source: 'AGL demo script' },
      { id: 'BR-T02', name: '$2,000 or more needs a person', simple: 'The AI may draft a plan, but only a person in the Resolution Team can approve it.', example: 'Priya owes $2,640, so Alex approves her plan.', where: 'Screen 1: "Human: Resolution Team". Screen 4: the 👤 check', source: 'AGL demo script' },
      { id: 'BR-T03', name: 'Life support: never automatic', simple: 'Someone at home relies on a life-support machine. No texts, emails or reminders. A trained person calls instead.', example: 'Margaret is never messaged.', where: 'Screen 4: "Never messaged" box', source: 'AGL demo script' },
      { id: 'BR-T04', name: 'Money troubles: a specialist helps', simple: 'The customer has a hardship or vulnerability flag, so a specialist person handles them.', example: '546 customers go to the Hardship team today.', where: 'Screen 1: Human teams list', source: 'AGL demo script' },
      { id: 'BR-T05', name: 'Bill older than 90 days: no extra time', simple: 'If the oldest unpaid bill is more than 90 days old, no extension. Only instalments or a long plan.', example: 'Tom\'s bill is 96 days old, so he gets no extension. The Guardian stopped 206 such extensions.', where: 'Screen 1: Guardian veto. Screen 3: Tom\'s note', source: 'AGL demo script' },
      { id: 'BR-T06', name: 'Broke 2 promises: a person checks first', simple: 'Broke 2 or more payment plans in the last 6 months, so a person reviews before a new plan.', example: 'Chloe broke 2 plans, so she goes to Human review.', where: 'Screen 4: Review queue', source: 'AGL demo script' },
      { id: 'BR-T07', name: 'Final warning stage: urgent', simple: 'At dunning stage 2 (final warning). Marked priority, and paying by card is suggested because it arrives fastest.', example: 'Tom is stage 2, so he shows a red "Priority" tag.', where: 'Screen 1 table. Screen 3: Tom\'s payment question', source: 'AGL demo script' },
      { id: 'BR-T08', name: 'Already paid: don\'t chase', simple: 'A payment was made less than 5 working days ago and is still on its way. Don\'t contact them; wait for it.', example: '522 customers are not contacted today for this reason.', where: 'Screen 1: "Not contacted" list', source: 'AGL demo script' },
    ],
  },
  {
    title: 'Messages and privacy',
    intro: 'Checked by the Guardian before any message is sent or shown.',
    rules: [
      { id: 'BR-C01', name: 'No amounts before they prove who they are', simple: 'Never show how much someone owes until they have entered their date of birth and the code sent to their phone. Texts never show amounts.', example: 'Sarah\'s 9 am text says "flexible options", not "$847.50".', where: 'Screen 2 text and login. Screen 5 texts', source: 'AGL demo script' },
      { id: 'BR-C05', name: 'Asked not to be contacted', simple: 'The customer asked not to be contacted, so nobody contacts them.', example: '55 customers today.', where: 'Screen 1: "Not contacted" list', source: 'Pay Assist design (BRD)' },
    ],
  },
  {
    title: 'Payment plans',
    intro: 'Every plan is built by the calculator and checked by the Guardian against these limits.',
    rules: [
      { id: 'BR-P01', name: 'Extra time: 21 days at most', simple: 'An extension can give at most 21 extra days to pay.', example: 'Sarah\'s part-pay option: the rest is due 29 Oct, 15 days away.', where: 'Screen 3: option 2', source: 'AGL demo script' },
      { id: 'BR-P02', name: 'Short plan: up to 3 months, equal payments', simple: 'Instalments run for up to 3 months. Every payment is the same; only the last may differ by a few cents.', example: 'Sarah: $231.25 every 2 weeks, 6 times.', where: 'Screen 3: option 3', source: 'AGL demo script' },
      { id: 'BR-P03', name: 'Long plan: 12 months (24 in Victoria)', simple: 'The Assist plan can run up to 12 months, or up to 24 months for customers in Victoria.', example: 'Sarah: 12 months at $115.67. Priya (Victoria) can have 24 months at $203.08.', where: 'Screen 3 slider. Screen 4 Copilot', source: 'AGL demo script' },
      { id: 'BR-P04', name: 'Bill smoothing: small debts only', simple: 'Paying the same amount every time is only offered if they owe less than $500 and have 12 months of bills.', example: 'Sarah owes $847.50, so no. Liam owes $310, so yes.', where: 'Screen 3: the note under the options', source: 'AGL demo script' },
      { id: 'BR-P05', name: 'Part pay must be part', simple: 'In "part pay + extra time", the amount paid today must be less than the total.', example: 'Sarah: $200 today of $847.50.', where: 'Screen 3: option 2', source: 'Pay Assist design (BRD)' },
      { id: 'CALC', name: 'The calculator check', simple: 'The payments must add up exactly and cover everything owed.', example: '25 × $115.67 + the last payment = $3,007.50 exactly.', where: 'Guardian checks (Screens 1 and 4)', source: 'Pay Assist design (BRD)' },
      { id: 'FR-GRD-06', name: 'The AI cannot make up numbers', simple: 'Every dollar amount the AI says must come from the calculator. If not, the Guardian blocks the message.', example: '"Message allowed: every amount came from the plan calculator".', where: 'Screen 3: Behind the scenes', source: 'Pay Assist design (BRD)' },
    ],
  },
  {
    title: 'After the plan starts',
    intro: 'Used by the Sustain agent to keep plans on track.',
    rules: [
      { id: 'BR-S01', name: 'Rescue a missed payment', simple: 'A missed payment can move up to 7 days later, as long as it is before the next payment and the amount stays the same. AGL\'s script leaves this open, so this is our suggestion.', example: 'Sarah\'s 29 Oct payment fails and moves to Mon 2 Nov.', where: 'Screen 5', source: 'Proposed, to confirm with AGL' },
    ],
  },
  {
    title: 'Handing over to a person',
    intro: 'When any of these happens, the AI stops and a person takes over.',
    rules: [
      { id: 'ESC-01', name: '$2,000 or more wants a plan', simple: 'Goes to the Resolution Team with balances and the plan the AI drafted.', example: 'Priya.', where: 'Screen 4', source: 'AGL demo script' },
      { id: 'ESC-02', name: 'Life support or medical', simple: 'Goes to the Specialist team.', example: 'Tap "Medical or personal circumstances" in the chat.', where: 'Screen 3', source: 'AGL demo script' },
      { id: 'ESC-03', name: 'Family violence or distress', simple: 'Priority handover to a specialist. Money talk stops at once, and only a short safety summary is passed on. The balance is hidden.', example: 'Tom says he is scared at home.', where: 'Screens 3 and 4', source: 'AGL demo script' },
      { id: 'ESC-04', name: 'Customer asks for a person', simple: 'Goes to a live agent, who sees the conversation so far.', example: 'Tap "I\'d like to speak to someone", or reply 3 on Screen 5.', where: 'Screens 3 and 5', source: 'AGL demo script' },
      { id: 'ESC-05', name: 'Hardship, prefers a specialist', simple: 'Goes to the Hardship team to talk about support and concessions.', example: 'Tap "Connect me to a specialist".', where: 'Screen 3', source: 'Pay Assist design (BRD)' },
      { id: 'ESC-06', name: 'Wrong code 3 times', simple: 'The journey ends safely and the customer is asked to call the contact centre.', example: 'Enter a wrong code 3 times.', where: 'Screen 2', source: 'AGL demo script' },
      { id: 'ESC-07', name: 'Payment fails twice', simple: 'A person helps with the payment.', example: 'Not shown in the demo: the first failure is retried successfully.', where: '(not shown)', source: 'AGL demo script' },
      { id: 'ESC-08', name: 'Says the bill is wrong', simple: 'Goes to the billing team and collection on the disputed amount pauses.', example: 'Type "this is a wrong bill" in the chat.', where: 'Screen 3', source: 'AGL demo script' },
      { id: 'ESC-09', name: 'Repeated broken plans', simple: 'A person reviews before any new plan.', example: 'Chloe.', where: 'Screen 4', source: 'Pay Assist design (BRD)' },
    ],
  },
  {
    title: 'Data and scoring',
    intro: 'How the morning file is checked and how "affordability" is worked out.',
    rules: [
      { id: 'FR-INT-02', name: 'Broken records are set aside', simple: 'Records with missing or wrong details are put aside with a reason instead of guessed at.', example: '23 records today: 9 no phone or email, 6 no state, 4 negative amount, 4 duplicates.', where: 'Screen 1: "Quarantined" box', source: 'Pay Assist design (BRD)' },
      { id: 'BRD 10.2', name: 'Affordability score', simple: 'What they usually pay ÷ their average bill. 1.0 or more = High, 0.6 to 0.99 = Medium, under 0.6 = Low (a hardship flag also means Low).', example: 'Sarah: $135 ÷ $180 = 0.75, so Medium.', where: 'Screen 1 table and customer panel', source: 'AGL demo script' },
    ],
  },
];

export const ALL_RULES: Rule[] = RULE_GROUPS.flatMap((g) => g.rules);

// Short meaning by code, used for hover text and the customer trace.
export const RULE_BOOK: Record<string, string> = Object.fromEntries(ALL_RULES.map((r) => [r.id, `${r.name}: ${r.simple}`]));
