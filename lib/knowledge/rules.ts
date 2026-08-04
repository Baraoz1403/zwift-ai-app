/**
 * Coaching rules — every rule is explicit, testable, and documented.
 * The AI prompt is built FROM these rules. Rules are not in the prompt text.
 */

// ─── Workout structure ────────────────────────────────────────────────────────

/** Every training day workout must contain these block types, in order */
export const REQUIRED_WORKOUT_STRUCTURE = ['warmup', 'intervals', 'cooldown'] as const;

/** Minimum number of interval blocks in a training day workout */
export const MIN_INTERVAL_BLOCKS = 3;

/** Workout name patterns that are forbidden on training days */
export const FORBIDDEN_WORKOUT_PATTERNS = [
  'Foundation Ride',
  'Free Ride',
  'Base Ride',
  'Easy Ride',
  'Endurance Ride',
  'Z2 Ride',
] as const;

/** Z2 is only allowed as warmup or cooldown — never as a standalone workout */
export const Z2_STANDALONE_FORBIDDEN = true;

// ─── Day types ────────────────────────────────────────────────────────────────

export type DayType = 'training' | 'recovery' | 'rest';

/**
 * On a REST day: no workout uploaded.
 * On a RECOVERY day: short Z1 or Z2 workout allowed (active recovery).
 * On a TRAINING day: must have structured intervals — no exceptions.
 */
export const DAY_TYPE_RULES: Record<DayType, string> = {
  training:  'Must have structured intervals. warmup + ≥3 interval blocks + cooldown.',
  recovery:  'Short Z1/Z2 only. 30–45 min max. No intervals.',
  rest:      'No workout. Full rest.',
};

// ─── Weekly plan rules ────────────────────────────────────────────────────────

/** Maximum consecutive training days before a rest or recovery day */
export const MAX_CONSECUTIVE_TRAINING_DAYS = 3;

/** Minimum rest/recovery days per week */
export const MIN_REST_RECOVERY_DAYS_PER_WEEK = 2;

/** TSS targets by phase */
export const PHASE_TSS_MULTIPLIERS = {
  base:     { min: 0.70, max: 0.85 }, // relative to athlete's CTL
  build:    { min: 0.85, max: 1.10 },
  taper:    { min: 0.40, max: 0.60 },
  race:     { min: 0.30, max: 0.50 },
  recovery: { min: 0.40, max: 0.60 },
} as const;

// ─── Workout composition rules ────────────────────────────────────────────────

/**
 * Intensity distribution per week — Polarized model.
 * ~80% of training time in Z1–Z2, ~20% in Z4+
 */
export const POLARIZED_DISTRIBUTION = {
  easyPercent:  80, // Z1–Z2
  hardPercent:  20, // Z4+
  tempoPercent:  0, // Z3 kept minimal
} as const;

/**
 * Workout type distribution in a training week.
 * At least one of each per week:
 */
export const REQUIRED_WORKOUT_TYPES_PER_WEEK = [
  'sweet-spot',     // 88–94% FTP
  'vo2max',         // 106–120% FTP
] as const;

// ─── Quality gate ─────────────────────────────────────────────────────────────

/** A plan fails quality gate if any of these are true */
export const QUALITY_GATE_FAILURES = {
  trainingDayWithoutIntervals:   'Training day has no interval blocks',
  forbiddenWorkoutOnTrainingDay: 'Forbidden workout type on training day',
  tooManyConsecutiveTrainingDays:'More than 3 consecutive training days',
  weeklyTSSOutOfRange:           'Weekly TSS outside acceptable range for phase',
  missingRequiredWorkoutType:    'Week missing required workout type (sweet-spot or vo2max)',
} as const;

export type QualityFailure = keyof typeof QUALITY_GATE_FAILURES;
