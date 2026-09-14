/**
 * dailyContent — deterministic daily quote, stress-release technique, and
 * productivity principles. Index = day-of-year % length, so every device
 * shows the same content on the same day. Pure module — shared with web.
 */

/** Deterministic day-of-year for IST (works from any runtime timezone). */
export function dayOfYearIST(d: Date = new Date()): number {
  // UTC ms of the moment, shifted to IST wall time; day key via UTC math only.
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const istDay = new Date(istMs); // interpreted in UTC = IST wall clock
  const startOfIstYear = Date.UTC(istDay.getUTCFullYear(), 0, 1);
  const today = Date.UTC(istDay.getUTCFullYear(), istDay.getUTCMonth(), istDay.getUTCDate());
  return Math.floor((today - startOfIstYear) / 86400000) + 1;
}

export interface DailyQuote {
  text: string;
  source: string;
}

export const QUOTES: DailyQuote[] = [
  { text: 'Your biggest superpower is your ability to be in a good mood.', source: 'You' },
  { text: 'Sacrifice is the key to success for your goals.', source: 'You' },
  { text: 'Take your goal as a personal mission.', source: 'You' },
  { text: 'Think of yourself as a stock — nobody is coming to solve your problems, so increase your growth rate.', source: 'You' },
  { text: 'You are like an app. If you have bugs, fix them and resolve.', source: 'You' },
  { text: 'You are capable of learning things faster. Be extraordinary at adapting.', source: 'You' },
  { text: 'Protect and direct your energy — it is your real currency.', source: 'You' },
  { text: 'If you want to connect with someone, let your light blend, not blind.', source: 'You' },
  { text: 'The best age to learn any topic is now — in days and weeks.', source: 'You' },
  { text: 'Surround yourself with people who are growing.', source: 'You' },
  { text: 'Understand things, have an opinion, then build — which needs sacrifice.', source: 'You' },
  { text: 'Sit and speak with yourself for 10–30 minutes daily.', source: 'You' },
  { text: 'Consistency compounds. Small daily wins beat rare big bursts.', source: 'Meridian' },
  { text: 'Discipline is choosing what you want most over what you want now.', source: 'Meridian' },
  { text: 'Steeple your hands, boost your confidence, and project calm authority.', source: 'You' },
  { text: 'Balance consistent income with inconsistent opportunities — that is where growth begins.', source: 'You' },
];

export function quoteForDate(d: Date = new Date()): DailyQuote {
  return QUOTES[dayOfYearIST(d) % QUOTES.length];
}

export interface StressTechnique {
  name: string;
  emoji: string;
  steps: string;
}

export const STRESS_TECHNIQUES: StressTechnique[] = [
  {
    name: 'Left-nostril breathing',
    emoji: '🫁',
    steps: 'Close your right nostril with your thumb. Inhale and exhale slowly through the left nostril 5 times.',
  },
  {
    name: 'Belly breathing',
    emoji: '🧘',
    steps: 'Place one hand on your stomach. Breathe deeply into your belly 5 times, feeling the hand rise and fall.',
  },
];

export function stressTechniquesForDate(d: Date = new Date()): StressTechnique[] {
  // Rotate the pair shown first by day so both get equal screen time.
  const idx = dayOfYearIST(d) % STRESS_TECHNIQUES.length;
  return [STRESS_TECHNIQUES[idx], STRESS_TECHNIQUES[(idx + 1) % STRESS_TECHNIQUES.length]];
}

export interface Principle {
  title: string;
  body: string;
}

/** Growth / productivity principles shown on Home. */
export const PRINCIPLES: Principle[] = [
  {
    title: 'Productivity & efficiency',
    body: 'Productivity and efficiency are important for growth. Do it yourself — stop waiting on others to solve your problems.',
  },
  {
    title: 'No shortcuts to wealth',
    body: 'Become more ambitious. Do not look for shortcuts to build wealth. Do not hunt lotteries — everyone is hunting those.',
  },
  {
    title: 'Build with sacrifice',
    body: 'Understand things, form your own opinion, then build. Building anything real needs sacrifice — sacrifice is the key to your goals.',
  },
  {
    title: 'Personal mission',
    body: 'Take your goal as a personal mission. The best age to learn anything is now, in days and weeks — not someday.',
  },
  {
    title: 'Grow like a stock',
    body: 'Think of yourself as a stock. Nobody is coming to solve your problem, so raise your growth rate. Surround yourself with people who are growing.',
  },
  {
    title: 'Ship, fix, adapt',
    body: 'You are like an app: if you have bugs, fix and resolve them. You can learn things faster than you think — be extraordinary at adapting.',
  },
];
