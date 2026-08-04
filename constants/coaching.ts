/**
 * App-level coaching constants — UI labels, day names, feedback options.
 *
 * These are the "display layer" counterparts to the typed constants in
 * lib/knowledge/. Nothing here drives coaching logic — it's all UI text
 * and enumeration values used by screens and components.
 */

// ─── Days of the week ─────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
};

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  monday:    'Mon',
  tuesday:   'Tue',
  wednesday: 'Wed',
  thursday:  'Thu',
  friday:    'Fri',
  saturday:  'Sat',
  sunday:    'Sun',
};

// ─── Day type display ─────────────────────────────────────────────────────────

export const DAY_TYPE_LABELS = {
  training: 'Training',
  recovery: 'Recovery',
  rest:     'Rest',
} as const;

export const DAY_TYPE_COLORS = {
  training: '#FF6B35',  // orange — hard work
  recovery: '#4CAF50',  // green — easy
  rest:     '#9E9E9E',  // grey — nothing
} as const;

// ─── Workout category display ─────────────────────────────────────────────────

export const WORKOUT_CATEGORY_LABELS = {
  recovery:       'Recovery',
  endurance:      'Endurance',
  tempo:          'Tempo',
  sweetspot:      'Sweet Spot',
  threshold:      'Threshold',
  vo2max:         'VO2max',
  neuromuscular:  'Neuromuscular',
  intermittent:   'Intermittent',
} as const;

export const WORKOUT_CATEGORY_COLORS = {
  recovery:      '#9E9E9E',  // grey
  endurance:     '#42A5F5',  // blue
  tempo:         '#66BB6A',  // green
  sweetspot:     '#FFA726',  // amber
  threshold:     '#EF5350',  // red
  vo2max:        '#AB47BC',  // purple
  neuromuscular: '#EC407A',  // pink
  intermittent:  '#FF7043',  // deep orange
} as const;

// ─── Training phase display ───────────────────────────────────────────────────

export const PHASE_LABELS = {
  base:     'Base',
  build:    'Build',
  taper:    'Taper',
  race:     'Race Week',
  recovery: 'Recovery',
} as const;

export const PHASE_COLORS = {
  base:     '#42A5F5',
  build:    '#FF7043',
  taper:    '#FFA726',
  race:     '#EF5350',
  recovery: '#66BB6A',
} as const;

// ─── Post-activity feedback options ──────────────────────────────────────────

export const FEEL_OPTIONS = [
  { value: 'much_easier', label: 'Much easier than expected', emoji: '😴' },
  { value: 'easier',      label: 'A bit easy',                emoji: '😌' },
  { value: 'as_expected', label: 'Nailed it',                 emoji: '✅' },
  { value: 'harder',      label: 'Harder than expected',      emoji: '😤' },
  { value: 'much_harder', label: 'Really struggled',          emoji: '🔥' },
] as const;

export type FeelValue = typeof FEEL_OPTIONS[number]['value'];

export const RPE_LABELS: Record<number, string> = {
  1:  'Basically resting',
  2:  'Very easy',
  3:  'Easy',
  4:  'Moderate',
  5:  'Somewhat hard',
  6:  'Hard',
  7:  'Very hard',
  8:  'Very very hard',
  9:  'Near max',
  10: 'Absolute max',
};

// ─── Block type display ───────────────────────────────────────────────────────

export const BLOCK_TYPE_LABELS = {
  warmup:    'Warm-up',
  intervals: 'Intervals',
  steady:    'Steady State',
  cooldown:  'Cool-down',
} as const;

export const BLOCK_TYPE_COLORS = {
  warmup:    '#FFA726',  // amber
  intervals: '#EF5350',  // red
  steady:    '#FF7043',  // orange
  cooldown:  '#42A5F5',  // blue
} as const;

// ─── ICU workout types (for upload) ───────────────────────────────────────────

/** Map from sport type to ICU workout type string */
export const ICU_WORKOUT_TYPES = {
  cycling: 'Zwift RIDE',
  running: 'Zwift RUN',
} as const;

// ─── Freshness display ────────────────────────────────────────────────────────

export const FRESHNESS_LABELS = {
  fresh:    'Fresh',
  neutral:  'Neutral',
  fatigued: 'Fatigued',
} as const;

export const FRESHNESS_COLORS = {
  fresh:    '#66BB6A',
  neutral:  '#FFA726',
  fatigued: '#EF5350',
} as const;

// ─── App-level limits ─────────────────────────────────────────────────────────

/** Maximum number of plan generation retries shown in UI before giving up */
export const MAX_PLAN_RETRIES_UI = 3;

/** Polling interval for new ICU activities (background check) */
export const ICU_POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/** Local cache TTL for a weekly plan */
export const PLAN_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
