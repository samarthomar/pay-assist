import type { Customer } from './types';

export const totalOverdue = (c: Customer) => c.accounts.reduce((s, a) => s + a.overdueCents, 0);
export const avgMonthlyBill = (c: Customer) => c.accounts.reduce((s, a) => s + a.avgMonthlyBillCents, 0);
export const oldestInvoiceDays = (c: Customer) => Math.max(...c.accounts.map((a) => a.oldestInvoiceDays));
export const fuelLabel = (c: Customer) => ({ elec: 'Electricity', gas: 'Gas', dual: 'Dual fuel' })[c.fuelType];

// The named demo customers from the BRD (section 6.2). All fictitious.
export const PERSONAS: Customer[] = [
  {
    id: 'CU-100815', persona: 'Sarah', name: 'Sarah Mitchell', firstName: 'Sarah', dob: '1988-03-12', state: 'VIC', fuelType: 'dual',
    accounts: [
      { number: '9100 4471 205', fuel: 'electricity', overdueCents: 51240, oldestInvoiceDays: 34, avgMonthlyBillCents: 11000 },
      { number: '9200 4471 206', fuel: 'gas', overdueCents: 33510, oldestInvoiceDays: 34, avgMonthlyBillCents: 7000 },
    ],
    monthsOfHistory: 12,
    payment: { onTimeLast12: 10, failedLast12: 0, avgPaymentCents: 13500, lastPaymentDaysAgo: 41 },
    arrangements: { extensionsHonouredLast12: 1, brokenLast6Months: 0 },
    flags: { concession: false, lifeSupport: false, hardship: false, vulnerability: false, doNotContact: false, dunningStage: 1 },
    contact: { mobile: '0412 555 218', email: 'sarah.mitchell@example.com', preferred: 'sms+email', storedCard: { brand: 'Visa', last4: '4821' } },
    riskCategory: 'medium',
  },
  {
    id: 'CU-100816', persona: 'B', name: 'Liam Carter', firstName: 'Liam', dob: '1993-07-04', state: 'NSW', fuelType: 'elec',
    accounts: [{ number: '9100 5520 118', fuel: 'electricity', overdueCents: 31000, oldestInvoiceDays: 19, avgMonthlyBillCents: 9500 }],
    monthsOfHistory: 12,
    payment: { onTimeLast12: 12, failedLast12: 0, avgPaymentCents: 10200, lastPaymentDaysAgo: 33 },
    arrangements: { extensionsHonouredLast12: 0, brokenLast6Months: 0 },
    flags: { concession: false, lifeSupport: false, hardship: false, vulnerability: false, doNotContact: false, dunningStage: 0 },
    contact: { mobile: '0423 555 904', email: 'liam.carter@example.com', preferred: 'sms+email', storedCard: { brand: 'Mastercard', last4: '1207' } },
    riskCategory: 'low',
  },
  {
    id: 'CU-100817', persona: 'C', name: 'Priya Raman', firstName: 'Priya', dob: '1979-11-23', state: 'VIC', fuelType: 'dual',
    accounts: [
      { number: '9100 6634 552', fuel: 'electricity', overdueCents: 158000, oldestInvoiceDays: 62, avgMonthlyBillCents: 21000 },
      { number: '9200 6634 553', fuel: 'gas', overdueCents: 106000, oldestInvoiceDays: 62, avgMonthlyBillCents: 12000 },
    ],
    monthsOfHistory: 12,
    payment: { onTimeLast12: 7, failedLast12: 1, avgPaymentCents: 26000, lastPaymentDaysAgo: 58 },
    arrangements: { extensionsHonouredLast12: 1, brokenLast6Months: 0 },
    flags: { concession: false, lifeSupport: false, hardship: false, vulnerability: false, doNotContact: false, dunningStage: 1 },
    contact: { mobile: '0434 555 671', email: 'priya.raman@example.com', preferred: 'sms+email' },
    riskCategory: 'medium',
  },
  {
    id: 'CU-100818', persona: 'D', name: 'Margaret Hughes', firstName: 'Margaret', dob: '1951-02-09', state: 'SA', fuelType: 'gas',
    accounts: [{ number: '9200 7745 310', fuel: 'gas', overdueCents: 42000, oldestInvoiceDays: 41, avgMonthlyBillCents: 9000 }],
    monthsOfHistory: 12,
    payment: { onTimeLast12: 9, failedLast12: 0, avgPaymentCents: 8200, lastPaymentDaysAgo: 47 },
    arrangements: { extensionsHonouredLast12: 0, brokenLast6Months: 0 },
    flags: { concession: true, lifeSupport: true, hardship: false, vulnerability: false, doNotContact: false, dunningStage: 1 },
    contact: { mobile: '0445 555 132', preferred: 'sms' },
    riskCategory: 'medium',
  },
  {
    id: 'CU-100819', persona: 'E', name: 'Tom Becker', firstName: 'Tom', dob: '1985-05-30', state: 'QLD', fuelType: 'elec',
    accounts: [{ number: '9100 8856 774', fuel: 'electricity', overdueCents: 69000, oldestInvoiceDays: 96, avgMonthlyBillCents: 12000 }],
    monthsOfHistory: 12,
    payment: { onTimeLast12: 6, failedLast12: 2, avgPaymentCents: 9000, lastPaymentDaysAgo: 75 },
    arrangements: { extensionsHonouredLast12: 0, brokenLast6Months: 1 },
    flags: { concession: false, lifeSupport: false, hardship: false, vulnerability: false, doNotContact: false, dunningStage: 2 },
    contact: { mobile: '0456 555 489', email: 'tom.becker@example.com', preferred: 'sms+email' },
    riskCategory: 'high',
  },
  {
    id: 'CU-100820', persona: 'F', name: 'Chloe Martin', firstName: 'Chloe', dob: '1990-09-17', state: 'NSW', fuelType: 'dual',
    accounts: [
      { number: '9100 9967 021', fuel: 'electricity', overdueCents: 72000, oldestInvoiceDays: 55, avgMonthlyBillCents: 13000 },
      { number: '9200 9967 022', fuel: 'gas', overdueCents: 43000, oldestInvoiceDays: 55, avgMonthlyBillCents: 6000 },
    ],
    monthsOfHistory: 12,
    payment: { onTimeLast12: 5, failedLast12: 3, avgPaymentCents: 12500, lastPaymentDaysAgo: 64 },
    arrangements: { extensionsHonouredLast12: 0, brokenLast6Months: 2 },
    flags: { concession: false, lifeSupport: false, hardship: false, vulnerability: false, doNotContact: false, dunningStage: 1 },
    contact: { mobile: '0467 555 350', email: 'chloe.martin@example.com', preferred: 'sms+email' },
    riskCategory: 'high',
  },
];

export const persona = (p: NonNullable<Customer['persona']>) => PERSONAS.find((c) => c.persona === p)!;
