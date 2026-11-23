/**
 * occipitalCare — canonical content and pure helpers for the Occipital Care
 * screen. No React Native imports here so this file is safe in Jest and on
 * the web mirror.
 *
 * Educational content only — not medical advice. See DISCLAIMER below.
 */

/** The animation a demonstration card plays. */
export type ExerciseMotion =
  | 'heat'
  | 'chinTuck'
  | 'tilt'
  | 'turn'
  | 'shoulder'
  | 'breathe';

export interface ExerciseDef {
  key: string;
  title: string;
  subtitle: string;
  dose: string;
  motion: ExerciseMotion;
  steps: string[];
  caution: string;
}

/** The six core daily exercises/rituals, each with an animated demo. */
export const EXERCISES: ExerciseDef[] = [
  {
    key: 'heat',
    title: 'Warm compress',
    subtitle: 'Relax the tight neck muscles around the nerve',
    dose: '15–20 min, morning & evening',
    motion: 'heat',
    steps: [
      'Apply a warm (not hot) compress or heating pad to the back of the neck.',
      'Keep the neck in a neutral, comfortable position while it warms.',
      'Use a cold pack instead if that feels better on the day.',
    ],
    caution: 'Warm, not scalding. Stop if the skin becomes red or irritated.',
  },
  {
    key: 'chin_tucks',
    title: 'Chin tucks',
    subtitle: 'Strengthen the deep neck stabilisers, decompress the nerve root',
    dose: '10 reps · hold 5 sec',
    motion: 'chinTuck',
    steps: [
      'Sit or stand tall, shoulders relaxed, looking straight ahead.',
      'Gently slide your chin straight back, making a "double chin".',
      'Hold for 5 seconds, then release slowly. No upward nodding.',
    ],
    caution: 'Stop if it causes sharp pain or dizziness. Movement should be small and pain-free.',
  },
  {
    key: 'neck_tilt',
    title: 'Gentle neck tilt',
    subtitle: 'Ease upper-neck and scalp tension',
    dose: '5 reps each side · hold 10 sec',
    motion: 'tilt',
    steps: [
      'Sit upright with both feet on the floor.',
      'Slowly tilt one ear toward the same shoulder until a gentle stretch is felt.',
      'Hold, return to centre, then repeat on the other side.',
    ],
    caution: 'Never force the stretch or pull with your hand. Avoid if it worsens the pain.',
  },
  {
    key: 'neck_turn',
    title: 'Slow neck turn',
    subtitle: 'Maintain pain-free range of motion',
    dose: '5 reps each direction',
    motion: 'turn',
    steps: [
      'Keep your shoulders still and your chin level.',
      'Turn your head slowly to one side, as far as is comfortable.',
      'Return to centre, then turn to the other side. Move slowly.',
    ],
    caution: 'No quick jerks or neck "cracking". Stop on sharp or electric pain.',
  },
  {
    key: 'shoulder_squeeze',
    title: 'Shoulder blade squeezes',
    subtitle: 'Undo the forward-hunched posture that pinches the nerve',
    dose: '10 reps · hold 5 sec',
    motion: 'shoulder',
    steps: [
      'Sit or stand with your arms at your sides.',
      'Squeeze your shoulder blades together and slightly down.',
      'Hold for 5 seconds, then relax. Breathe normally throughout.',
    ],
    caution: 'Keep the neck relaxed — do not lift your shoulders toward your ears.',
  },
  {
    key: 'breathe',
    title: 'Slow breathing',
    subtitle: 'Lower stress-driven muscle tension',
    dose: '2 min · 6 breaths/min',
    motion: 'breathe',
    steps: [
      'Sit comfortably with your shoulders down.',
      'Breathe in slowly through the nose for about 4 seconds.',
      'Breathe out slowly for about 6 seconds. Repeat for two minutes.',
    ],
    caution: 'If you feel light-headed, return to normal breathing.',
  },
];

export type HabitGroup = 'Movement' | 'Posture' | 'Lifestyle' | 'Treatment';

export interface CareHabit {
  key: string;
  label: string;
  group: HabitGroup;
  emoji: string;
}

/**
 * Daily habits that reduce nerve irritation. Movement keys match exercise
 * keys so ticking an exercise also ticks its matching habit.
 */
export const HABITS: CareHabit[] = [
  { key: 'heat', label: 'Warm compress on neck', group: 'Movement', emoji: '🔥' },
  { key: 'chin_tucks', label: 'Chin tucks × 10', group: 'Movement', emoji: '🧘' },
  { key: 'neck_tilt', label: 'Gentle neck tilts', group: 'Movement', emoji: '↔️' },
  { key: 'neck_turn', label: 'Slow neck turns', group: 'Movement', emoji: '🔄' },
  { key: 'shoulder_squeeze', label: 'Shoulder blade squeezes', group: 'Movement', emoji: '💪' },
  { key: 'breathe', label: '2 min slow breathing', group: 'Movement', emoji: '🌬️' },
  { key: 'walk_yoga', label: '20–30 min walk or yoga', group: 'Movement', emoji: '🚶' },
  { key: 'screen_eye_level', label: 'Screen at eye level (no tech neck)', group: 'Posture', emoji: '🖥️' },
  { key: 'break_45', label: 'Stand & move every 30–45 min', group: 'Posture', emoji: '⏰' },
  { key: 'no_phone_shoulder', label: 'No phone between ear and shoulder', group: 'Posture', emoji: '📵' },
  { key: 'water', label: 'Drink water regularly', group: 'Lifestyle', emoji: '💧' },
  { key: 'regular_meals', label: 'Regular meals (no skipping)', group: 'Lifestyle', emoji: '🍽️' },
  { key: 'sleep_pillow', label: 'Supportive pillow, consistent sleep', group: 'Lifestyle', emoji: '😴' },
  { key: 'food_diary', label: 'Log food & headache triggers', group: 'Lifestyle', emoji: '📔' },
  { key: 'meds_time', label: 'Pregabalin on time (do not stop abruptly)', group: 'Treatment', emoji: '💊' },
];

export const HABIT_GROUPS: HabitGroup[] = ['Movement', 'Posture', 'Lifestyle', 'Treatment'];

/** One local day row for the care checklist. */
export interface CareDay {
  id: string;
  /** IST day key, YYYY-MM-DD */
  day: string;
  done: string[];
  /** 0–10, or null when not logged */
  pain: number | null;
}

/** Stable local row id for a day key. */
export function careDayId(dayKey: string): string {
  return `oc_${dayKey.replace(/-/g, '')}`;
}

/**
 * IST calendar day key (YYYY-MM-DD) from a Date or ISO string.
 * Pure UTC math — correct from any runtime timezone (device or CI).
 */
export function careDayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function todayCareKey(): string {
  return careDayKey(new Date());
}

/** Shift an IST day key (YYYY-MM-DD) by n days. */
export function shiftCareDay(dayKey: string, n: number): string {
  const t = new Date(`${dayKey}T00:00:00Z`).getTime() + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Unique list of every tickable item key (exercises + habits). */
export const ALL_CARE_KEYS: string[] = Array.from(
  new Set([...EXERCISES.map((e) => e.key), ...HABITS.map((h) => h.key)])
);

/** 0..1 completion ratio against all care items. */
export function careProgress(done: string[], total: number = ALL_CARE_KEYS.length): number {
  if (total <= 0) return 0;
  const valid = done.filter((k) => ALL_CARE_KEYS.includes(k));
  return Math.min(1, valid.length / total);
}

/** Find a stored day row by key. */
export function careDayFor(days: CareDay[], dayKey: string): CareDay | undefined {
  return days.find((d) => d.day === dayKey);
}

/**
 * Consecutive-day streak for one item, counting back from today (or from
 * yesterday if today is not yet ticked).
 */
export function careStreak(days: CareDay[], key: string): number {
  const logged = new Set(
    days.filter((d) => d.done.includes(key)).map((d) => d.day)
  );
  if (logged.size === 0) return 0;

  let cursor = todayCareKey();
  if (!logged.has(cursor)) cursor = shiftCareDay(cursor, -1);

  let streak = 0;
  for (let guard = 0; guard < 365; guard++) {
    if (!logged.has(cursor)) break;
    streak += 1;
    cursor = shiftCareDay(cursor, -1);
  }
  return streak;
}

export const CAUSES: string[] = [
  'Tight neck muscles / chronic tension — the most common cause.',
  'Poor posture and repetitive strain ("tech neck", looking down at a phone).',
  'Head or neck injury — whiplash, concussion, falls.',
  'Osteoarthritis of the upper cervical spine (C1–C2 / C2–C3 joints).',
  'Less common: tumours, gout, inflammation, infection, multiple sclerosis, CSF leak.',
];

export const FOODS_HELP: string[] = [
  'Omega‑3: salmon, mackerel, sardines, walnuts, flaxseed, chia.',
  'Magnesium: spinach, pumpkin seeds, almonds, bananas, avocados.',
  'B vitamins: eggs, fish, whole grains, lentils, dairy.',
  'Turmeric with a pinch of black pepper, and ginger.',
  'Plenty of water; colourful vegetables and berries.',
];

export const FOODS_LIMIT: string[] = [
  'Aged cheese, cured meats, chocolate (common headache triggers).',
  'Alcohol — especially with pregabalin (adds drowsiness).',
  'Excess caffeine or sudden caffeine withdrawal.',
  'MSG, aspartame, fried and ultra-processed foods, added sugar.',
  'Skipping meals — keep meal times regular.',
];

export const RED_FLAGS: string[] = [
  'Sudden, severe "worst" headache, especially with a stiff neck.',
  'Headache with fever, nausea/vomiting, confusion or vision changes.',
  'New weakness, numbness, or difficulty speaking (possible stroke).',
  'Headache after a head or neck injury.',
  'Worsening pattern, or a new constant headache after age 50.',
];

export const DISCLAIMER =
  'For information only — not medical advice. Occipital neuralgia needs proper '
  + 'assessment by a doctor. Keep taking prescribed medicine and do not stop '
  + 'pregabalin suddenly; taper only with your doctor. Stop any exercise that '
  + 'causes sharp pain and seek care for the red flags listed above.';
