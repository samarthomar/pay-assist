// Core domain types. All money is held in integer cents to avoid rounding errors.

export type Fuel = 'electricity' | 'gas';
export type FuelType = 'elec' | 'gas' | 'dual';
export type AuState = 'VIC' | 'NSW' | 'QLD' | 'SA' | 'ACT';
export type Frequency = 'weekly' | 'fortnightly' | 'monthly';
export type RiskCategory = 'low' | 'medium' | 'high';

export interface ContractAccount {
  number: string;
  fuel: Fuel;
  overdueCents: number;
  oldestInvoiceDays: number;
  avgMonthlyBillCents: number;
}

export interface Customer {
  id: string;
  persona?: 'Sarah' | 'B' | 'C' | 'D' | 'E' | 'F';
  name: string;
  firstName: string;
  dob: string; // YYYY-MM-DD
  state: AuState;
  fuelType: FuelType;
  accounts: ContractAccount[];
  monthsOfHistory: number;
  payment: {
    onTimeLast12: number;
    failedLast12: number;
    avgPaymentCents: number;
    lastPaymentDaysAgo: number;
    inTransit?: { cents: number; postedBusinessDaysAgo: number; method: string };
  };
  arrangements: { extensionsHonouredLast12: number; brokenLast6Months: number };
  flags: {
    concession: boolean;
    lifeSupport: boolean;
    hardship: boolean;
    vulnerability: boolean;
    doNotContact: boolean;
    dunningStage: 0 | 1 | 2;
  };
  contact: {
    mobile?: string;
    email?: string;
    preferred: 'sms+email' | 'sms' | 'email';
    storedCard?: { brand: 'Visa' | 'Mastercard'; last4: string };
  };
  riskCategory: RiskCategory;
}

export type PlanType = 'full' | 'part_extension' | 'extension' | 'instalment' | 'assist' | 'bill_smoothing';

export interface Plan {
  type: PlanType;
  label: string;
  totalCents: number; // everything the customer pays under this plan
  upfrontCents?: number; // paid today
  dueDate?: string; // extension / part-pay remainder date
  frequency?: Frequency;
  months?: number;
  count?: number; // number of instalments
  instalmentCents?: number;
  lastInstalmentCents?: number;
  firstDate?: string;
  lastDate?: string;
  explanation: string;
}

export type ContactDecision = 'ai' | 'human' | 'none';

export interface RuleHit {
  id: string; // e.g. BR-T02
  text: string;
}

export interface Assessment {
  customerId: string;
  decision: ContactDecision;
  route?: 'Resolution Team' | 'Specialist team' | 'Hardship team' | 'Human review';
  segment: string;
  affordability: { index: number; band: 'High' | 'Medium' | 'Low' };
  extensionAllowed: boolean;
  eligible: PlanType[];
  recommended?: Plan;
  draftForHuman?: Plan;
  priority: boolean;
  reasonCode: string;
  reason: string;
  rules: RuleHit[];
}
