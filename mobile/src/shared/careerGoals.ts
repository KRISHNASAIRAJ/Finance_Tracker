/**
 * careerGoals — 2025→2031 roadmap. Static content shared by the Career
 * Goals screen (mobile + web). Amounts are rupee targets, not paise.
 */

export interface CareerGoalYear {
  year: number;
  title: string;
  emoji: string;
  items: string[];
  done?: boolean;
}

export const CAREER_GOALS: CareerGoalYear[] = [
  {
    year: 2025,
    title: 'Foundation',
    emoji: '🌱',
    items: [
      'Net worth ₹80,700',
      'FDs → ₹40,706',
      'MFs → ₹8,000',
      'Liquid → ₹32,000',
      'Interest: ₹32,000 → ₹38,000 + ₹4,000 by Dec 31 2025',
    ],
    done: true,
  },
  {
    year: 2026,
    title: 'Momentum',
    emoji: '🚀',
    items: [
      'Equity portfolio value ₹50K',
      'April 15 → ₹4,500 crypto',
      'May 15 → ₹9,300 FD',
      'June 15 → ₹7,500 emergency fund',
      'Mutual fund portfolio ₹50,000',
      'Net worth ₹2 lakh',
      'Bike',
    ],
  },
  {
    year: 2027,
    title: 'Scale',
    emoji: '📈',
    items: [
      'Equity portfolio value ₹1.5 lakh',
      'Mutual fund portfolio ₹1 lakh',
      'Net worth ₹4 lakh',
      'Around July — try for a switch',
    ],
  },
  {
    year: 2028,
    title: 'Consolidation',
    emoji: '🛡️',
    items: [
      'Equity portfolio value ₹1.75 lakh',
      'Mutual fund portfolio ₹1.25 lakh',
      'Net worth ₹6 lakh',
      'Change phone (prefer security)',
    ],
  },
  {
    year: 2029,
    title: 'Project 2029',
    emoji: '🔥',
    items: [
      'Equity portfolio value ₹2 lakh',
      'Mutual fund portfolio ₹1.5 lakh',
      'Net worth ₹9 lakh',
      'Project 2029 — Phase M (~₹10L)',
    ],
  },
  {
    year: 2030,
    title: 'Project Green',
    emoji: '🌾',
    items: [
      'Equity portfolio value ₹2.5 lakh',
      'Mutual fund portfolio ₹2 lakh',
      'Net worth ₹10 lakh',
      'Project Green 🌱 (2 acres)',
    ],
  },
  {
    year: 2031,
    title: 'Home Base',
    emoji: '🏡',
    items: [
      'Equity portfolio value ₹3 lakh',
      'Mutual fund portfolio ₹2.5 lakh',
      'Net worth ₹12 lakh',
      'Mission Hometown Base 🏡',
    ],
  },
];

/** Goals for the current year (view-computed, used for progress display). */
export function currentYearGoals(now: Date = new Date()): CareerGoalYear | undefined {
  return CAREER_GOALS.find((g) => g.year === now.getFullYear());
}
