import { PERSONAS } from './customers';
import { seeded } from './money';
import type { AuState, ContractAccount, Customer, FuelType } from './types';

// The daily overdue file: 12,457 residential accounts (7,214 electricity, 2,931 gas, 2,312 dual fuel),
// including the six named personas, generated from a fixed seed so every run is identical.
export const FILE_COUNTS = { elec: 7214, gas: 2931, dual: 2312, total: 12457 };

const FIRST = ['Olivia', 'Noah', 'Charlotte', 'Jack', 'Amelia', 'William', 'Isla', 'Oliver', 'Mia', 'Henry', 'Ava', 'Leo', 'Grace', 'Lucas',
  'Chloe', 'Thomas', 'Zoe', 'James', 'Ruby', 'Ethan', 'Emily', 'Hugo', 'Sophie', 'Lachlan', 'Harper', 'Mason', 'Ella', 'Cooper', 'Aisha', 'Arjun',
  'Mei', 'Kai', 'Layla', 'Hamish', 'Ivy', 'Daniel', 'Hannah', 'Sam', 'Lily', 'Ben'];
const LAST = ['Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Taylor', 'Nguyen', 'Johnson', 'Martin', 'White', 'Anderson', 'Walker', 'Thompson',
  'Kelly', 'Ryan', 'Lee', 'Harris', 'King', 'Robinson', 'Wright', 'Patel', 'Singh', 'Chen', 'Wang', 'Murphy', "O'Brien", 'Campbell', 'Clarke',
  'Evans', 'Scott', 'Young', 'Hall', 'Allen', 'Green', 'Baker', 'Hill', 'Ward', 'Mitchell', 'Cooper', 'Reid'];
const STATES: [AuState, number][] = [['VIC', 31], ['NSW', 30], ['QLD', 21], ['SA', 14], ['ACT', 4]];

export type IntakeIssue = 'missing_contact' | 'missing_state' | 'negative_balance' | 'duplicate_id';

export interface FileRecord {
  customer: Customer;
  issue?: IntakeIssue;
}

export interface OverdueFile {
  name: string;
  receivedAt: string;
  records: FileRecord[];
}

export function generateOverdueFile(seed = 20261014): OverdueFile {
  const r = seeded(seed);
  const records: FileRecord[] = PERSONAS.map((customer) => ({ customer }));
  const left: Record<FuelType, number> = {
    elec: FILE_COUNTS.elec - PERSONAS.filter((p) => p.fuelType === 'elec').length,
    gas: FILE_COUNTS.gas - PERSONAS.filter((p) => p.fuelType === 'gas').length,
    dual: FILE_COUNTS.dual - PERSONAS.filter((p) => p.fuelType === 'dual').length,
  };
  const fuels: FuelType[] = [];
  (Object.keys(left) as FuelType[]).forEach((f) => { for (let i = 0; i < left[f]; i++) fuels.push(f); });
  // Interleave fuel types deterministically.
  for (let i = fuels.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [fuels[i], fuels[j]] = [fuels[j], fuels[i]];
  }

  fuels.forEach((fuelType, i) => {
    const firstName = r.pick(FIRST);
    const last = r.pick(LAST);
    const state = r.weighted(STATES);
    const age = r.weighted<number>([[r.int(5, 30), 50], [r.int(31, 60), 30], [r.int(61, 90), 13], [r.int(91, 150), 7]]);
    // Overdue amounts follow a long tail: most $150 to $900, few above $2,000.
    const scale = r.weighted<number>([[r.int(12000, 40000), 45], [r.int(40000, 90000), 33], [r.int(90000, 190000), 16], [r.int(200000, 420000), 6]]);
    const elecAvg = r.int(7000, 19000);
    const gasAvg = r.int(4000, 12000);
    const accounts: ContractAccount[] = [];
    const acct = (n: number) => `${n} ${String(1000 + (i % 9000)).padStart(4, '0')} ${String(r.int(100, 999))}`;
    if (fuelType !== 'gas') {
      accounts.push({ number: acct(9100), fuel: 'electricity', overdueCents: fuelType === 'dual' ? Math.round(scale * 0.62) : scale, oldestInvoiceDays: age, avgMonthlyBillCents: elecAvg });
    }
    if (fuelType !== 'elec') {
      accounts.push({ number: acct(9200), fuel: 'gas', overdueCents: fuelType === 'dual' ? scale - Math.round(scale * 0.62) : scale, oldestInvoiceDays: age, avgMonthlyBillCents: gasAvg });
    }
    const avgBill = accounts.reduce((s, a) => s + a.avgMonthlyBillCents, 0);
    const payRatio = r.weighted<number>([[r.int(100, 130) / 100, 30], [r.int(60, 99) / 100, 50], [r.int(25, 59) / 100, 20]]);
    const onTime = r.int(3, 12);
    const inTransit = r.chance(0.04) ? { cents: r.int(5000, 40000), postedBusinessDaysAgo: r.int(1, 4), method: r.pick(['card', 'BPAY', 'PayPal', 'Australia Post']) } : undefined;
    const customer: Customer = {
      id: `CU-${200000 + i}`,
      name: `${firstName} ${last}`,
      firstName,
      dob: `${r.int(1945, 2004)}-${String(r.int(1, 12)).padStart(2, '0')}-${String(r.int(1, 28)).padStart(2, '0')}`,
      state,
      fuelType,
      accounts,
      monthsOfHistory: r.chance(0.9) ? 12 : r.int(3, 11),
      payment: { onTimeLast12: onTime, failedLast12: r.int(0, 12 - onTime > 3 ? 3 : 12 - onTime), avgPaymentCents: Math.round(avgBill * payRatio), lastPaymentDaysAgo: r.int(10, 120), inTransit },
      arrangements: { extensionsHonouredLast12: r.int(0, 2), brokenLast6Months: r.weighted<number>([[0, 88], [1, 8], [2, 3], [3, 1]]) },
      flags: {
        concession: r.chance(0.18),
        lifeSupport: r.chance(0.006),
        hardship: r.chance(0.03),
        vulnerability: r.chance(0.015),
        doNotContact: r.chance(0.004),
        dunningStage: r.weighted<0 | 1 | 2>([[0, 35], [1, 55], [2, 10]]),
      },
      contact: {
        mobile: `04${r.int(10, 99)} 555 ${String(r.int(0, 999)).padStart(3, '0')}`,
        email: `${firstName}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
        preferred: r.weighted([['sms+email', 70], ['sms', 20], ['email', 10]] as const),
        storedCard: r.chance(0.45) ? { brand: r.pick(['Visa', 'Mastercard'] as const), last4: String(r.int(1000, 9999)) } : undefined,
      },
      riskCategory: onTime >= 10 ? 'low' : onTime >= 6 ? 'medium' : 'high',
    };
    records.push({ customer });
  });

  // Plant a small number of defective records so intake validation has something real to catch.
  const plant = (issue: IntakeIssue, count: number, start: number) => {
    for (let k = 0; k < count; k++) {
      const rec = records[start + k * 397];
      rec.issue = issue;
      if (issue === 'missing_contact') rec.customer = { ...rec.customer, contact: { ...rec.customer.contact, mobile: undefined, email: undefined } };
      if (issue === 'missing_state') rec.customer = { ...rec.customer, state: '' as AuState };
      if (issue === 'negative_balance') rec.customer = { ...rec.customer, accounts: rec.customer.accounts.map((a) => ({ ...a, overdueCents: -a.overdueCents })) };
      if (issue === 'duplicate_id') rec.customer = { ...rec.customer, id: records[start + k * 397 - 1].customer.id };
    }
  };
  plant('missing_contact', 9, 101);
  plant('missing_state', 6, 211);
  plant('negative_balance', 4, 307);
  plant('duplicate_id', 4, 419);

  return { name: 'AGL_overdue_residential_2026-10-14.csv', receivedAt: '2026-10-14T06:12:00', records };
}

const ISSUE_TEXT: Record<IntakeIssue, string> = {
  missing_contact: 'No mobile or email: cannot contact digitally',
  missing_state: 'Missing supply state: state rules cannot be applied',
  negative_balance: 'Negative overdue amount: likely a credit, not arrears',
  duplicate_id: 'Duplicate customer ID in file',
};

// Intake validation (FR-INT-02): quarantine invalid records with a reason.
export function validateFile(file: OverdueFile) {
  const seen = new Set<string>();
  const valid: Customer[] = [];
  const rejected: { customer: Customer; reason: string }[] = [];
  for (const { customer: c } of file.records) {
    let reason: string | undefined;
    if (seen.has(c.id)) reason = ISSUE_TEXT.duplicate_id;
    else if (!c.state) reason = ISSUE_TEXT.missing_state;
    else if (c.accounts.some((a) => a.overdueCents <= 0)) reason = ISSUE_TEXT.negative_balance;
    else if (!c.contact.mobile && !c.contact.email) reason = ISSUE_TEXT.missing_contact;
    seen.add(c.id);
    if (reason) rejected.push({ customer: c, reason });
    else valid.push(c);
  }
  const byFuel = { elec: 0, gas: 0, dual: 0 };
  file.records.forEach((r) => byFuel[r.customer.fuelType]++);
  return { total: file.records.length, byFuel, valid, rejected };
}
