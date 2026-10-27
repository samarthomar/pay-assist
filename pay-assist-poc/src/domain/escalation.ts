import type { VulnerabilitySignal } from './guardian';

// Human-in-the-loop escalation matrix (BRD section 11).
export interface Escalation {
  id: string;
  trigger: string;
  routeTo: string;
  context: 'full' | 'minimal' | 'attempts' | 'payment' | 'dispute';
  customerMessage: string;
  priority: boolean;
}

export const ESCALATIONS: Record<string, Escalation> = {
  'ESC-01': { id: 'ESC-01', trigger: 'Overdue $2,000 or more and arrangement requested', routeTo: 'Resolution Team', context: 'full', customerMessage: 'A specialist will confirm your plan within one business day.', priority: false },
  'ESC-02': { id: 'ESC-02', trigger: 'Life support or medical condition', routeTo: 'Specialist team', context: 'full', customerMessage: "I'm connecting you with our specialist team who can help properly.", priority: true },
  'ESC-03': { id: 'ESC-03', trigger: 'Family violence or distress language', routeTo: 'Specialist (priority)', context: 'minimal', customerMessage: "Thank you for telling me. Your safety comes first. I'm putting you in touch with a specialist now, and nothing more is needed from you about this bill today.", priority: true },
  'ESC-04': { id: 'ESC-04', trigger: 'Customer asks for a person', routeTo: 'Live agent', context: 'full', customerMessage: 'Of course. I\'m connecting you with a member of our team, and they\'ll see our conversation so you won\'t need to repeat anything.', priority: false },
  'ESC-05': { id: 'ESC-05', trigger: 'Hardship disclosed, prefers specialist', routeTo: 'Hardship team', context: 'full', customerMessage: 'Our hardship team can talk with you about support, concessions and payment options.', priority: false },
  'ESC-06': { id: 'ESC-06', trigger: 'Verification failed 3 times', routeTo: 'Contact centre', context: 'attempts', customerMessage: "I'm unable to verify your identity right now. Please try again later or call our contact centre.", priority: false },
  'ESC-07': { id: 'ESC-07', trigger: 'Payment failed twice', routeTo: 'Live agent / callback', context: 'payment', customerMessage: 'Would you like a member of our team to help you with payment?', priority: false },
  'ESC-08': { id: 'ESC-08', trigger: 'Customer disputes the bill', routeTo: 'Billing team', context: 'dispute', customerMessage: "I've noted your concern about the bill. Our billing team will review it, and we'll pause collection on the disputed amount.", priority: false },
  'ESC-09': { id: 'ESC-09', trigger: '2 or more broken arrangements, or a broken plan', routeTo: 'Human review', context: 'full', customerMessage: 'A specialist will be in touch to find an option that works for you.', priority: false },
};

export const escalationForSignal = (s: VulnerabilitySignal): Escalation =>
  ESCALATIONS[{ family_violence: 'ESC-03', distress: 'ESC-03', life_support: 'ESC-02', medical: 'ESC-02', request_human: 'ESC-04', dispute: 'ESC-08' }[s]];
