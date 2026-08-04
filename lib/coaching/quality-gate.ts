/**
 * Quality Gate — validates every generated plan before it reaches the athlete.
 * This is CODE, not a prompt. The AI cannot bypass it.
 *
 * Usage:
 *   const result = validatePlan(plan, athleteProfile);
 *   if (!result.passed) { // retry with result.failures in the prompt }
 */

import {
  MIN_INTERVAL_BLOCKS,
  FORBIDDEN_WORKOUT_PATTERNS,
  MAX_CONSECUTIVE_TRAINING_DAYS,
  QUALITY_GATE_FAILURES,
  type QualityFailure,
} from '../knowledge/rules';
import { targetWeeklyTSS } from '../knowledge/periodization';
import type { TrainingPhase } from '../knowledge/periodization';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkoutBlock {
  type: 'warmup' | 'intervals' | 'cooldown' | 'steady';
  durationMin: number;
  powerPct?: number;   // % of FTP
  paceZone?: number;   // running pace zone
  reps?: number;
}

export interface DayWorkout {
  day: string;           // 'monday', 'tuesday', etc.
  dayType: 'training' | 'recovery' | 'rest';
  workoutName?: string;
  workoutType?: string;  // 'sweet-spot', 'vo2max', 'threshold', etc.
  blocks?: WorkoutBlock[];
  estimatedTSS?: number;
}

export interface WeeklyPlan {
  weekOf: string;
  workouts: DayWorkout[];
  totalTSS?: number;
}

export interface QualityResult {
  passed: boolean;
  failures: QualityFailure[];
  details: string[];
}

// ─── Validators ───────────────────────────────────────────────────────────────

function checkTrainingDayStructure(workout: DayWorkout): QualityFailure[] {
  const failures: QualityFailure[] = [];
  if (workout.dayType !== 'training') return failures;

  const blocks = workout.blocks ?? [];
  const intervalBlocks = blocks.filter(b => b.type === 'intervals');

  if (intervalBlocks.length < MIN_INTERVAL_BLOCKS) {
    failures.push('trainingDayWithoutIntervals');
  }

  const name = workout.workoutName ?? '';
  const isForbidden = FORBIDDEN_WORKOUT_PATTERNS.some(p =>
    name.toLowerCase().includes(p.toLowerCase())
  );
  if (isForbidden) {
    failures.push('forbiddenWorkoutOnTrainingDay');
  }

  return failures;
}

function checkConsecutiveTrainingDays(workouts: DayWorkout[]): QualityFailure[] {
  let consecutive = 0;
  for (const w of workouts) {
    if (w.dayType === 'training') {
      consecutive++;
      if (consecutive > MAX_CONSECUTIVE_TRAINING_DAYS) {
        return ['tooManyConsecutiveTrainingDays'];
      }
    } else {
      consecutive = 0;
    }
  }
  return [];
}

function checkWeeklyTSS(
  plan: WeeklyPlan,
  ctl: number,
  phase: TrainingPhase
): QualityFailure[] {
  const total = plan.totalTSS
    ?? plan.workouts.reduce((s, w) => s + (w.estimatedTSS ?? 0), 0);
  if (total === 0) return []; // can't check without TSS estimates

  const target = targetWeeklyTSS(ctl, phase);
  if (total < target.min || total > target.max) {
    return ['weeklyTSSOutOfRange'];
  }
  return [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function validatePlan(
  plan: WeeklyPlan,
  context: { ctl: number; phase: TrainingPhase }
): QualityResult {
  const failures: QualityFailure[] = [];
  const details: string[] = [];

  for (const workout of plan.workouts) {
    const f = checkTrainingDayStructure(workout);
    for (const failure of f) {
      failures.push(failure);
      details.push(`${workout.day}: ${QUALITY_GATE_FAILURES[failure]}`);
    }
  }

  const consecutive = checkConsecutiveTrainingDays(plan.workouts);
  for (const f of consecutive) {
    failures.push(f);
    details.push(QUALITY_GATE_FAILURES[f]);
  }

  const tssFailures = checkWeeklyTSS(plan, context.ctl, context.phase);
  for (const f of tssFailures) {
    failures.push(f);
    details.push(QUALITY_GATE_FAILURES[f]);
  }

  return {
    passed: failures.length === 0,
    failures: [...new Set(failures)],
    details,
  };
}

/**
 * Build a diagnostic message to include in the AI retry prompt.
 * The AI sees exactly what failed and why.
 */
export function buildRetryDiagnostic(result: QualityResult): string {
  return [
    '⚠️ PLAN REJECTED — quality gate failures:',
    ...result.details.map(d => `  - ${d}`),
    '',
    'Fix ALL of the above before responding. Do not repeat these mistakes.',
  ].join('\n');
}
