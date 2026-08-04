/**
 * Periodization — macro-cycle structure and phase logic.
 * Determines what kind of training is appropriate given athlete state.
 */

import { PHASE_TSS_MULTIPLIERS } from './rules';

export type TrainingPhase = 'base' | 'build' | 'taper' | 'race' | 'recovery';

export interface PhaseDefinition {
  name: TrainingPhase;
  durationWeeks: number;
  focus: string;
  allowedWorkoutIntensities: string[];
  tssMultiplier: typeof PHASE_TSS_MULTIPLIERS[TrainingPhase];
}

export const PHASE_DEFINITIONS: Record<TrainingPhase, PhaseDefinition> = {
  base: {
    name: 'base',
    durationWeeks: 4,
    focus: 'Aerobic base, sweet spot, build CTL. No anaerobic work.',
    allowedWorkoutIntensities: ['Z2', 'Z3', 'sweet-spot', 'threshold'],
    tssMultiplier: PHASE_TSS_MULTIPLIERS.base,
  },
  build: {
    name: 'build',
    durationWeeks: 4,
    focus: 'VO2max, threshold, race-specific intensity. CTL peaks here.',
    allowedWorkoutIntensities: ['Z2', 'sweet-spot', 'threshold', 'vo2max', 'anaerobic'],
    tssMultiplier: PHASE_TSS_MULTIPLIERS.build,
  },
  taper: {
    name: 'taper',
    durationWeeks: 1,
    focus: 'Reduce volume, maintain intensity. Freshen legs.',
    allowedWorkoutIntensities: ['Z2', 'threshold', 'vo2max'],
    tssMultiplier: PHASE_TSS_MULTIPLIERS.taper,
  },
  race: {
    name: 'race',
    durationWeeks: 1,
    focus: 'Race week. Minimal fatigue, activation only.',
    allowedWorkoutIntensities: ['Z2', 'vo2max'],
    tssMultiplier: PHASE_TSS_MULTIPLIERS.race,
  },
  recovery: {
    name: 'recovery',
    durationWeeks: 1,
    focus: 'Full recovery. Easy only. Let adaptations consolidate.',
    allowedWorkoutIntensities: ['Z1', 'Z2'],
    tssMultiplier: PHASE_TSS_MULTIPLIERS.recovery,
  },
};

/**
 * Determine current phase from athlete's TSB and CTL trend.
 *
 * Logic:
 *  - TSB < -25 → recovery (too fatigued for any real training)
 *  - TSB > 15 + falling load → taper (fresh and de-loading; event likely approaching)
 *  - TSB > -15 with rising or stable load → build (normal training, can handle intensity)
 *  - TSB -15 to -25 → base (moderately fatigued; back off to aerobic work)
 *  - Anything else → base (conservative fallback)
 */
export function determinePhase(tsb: number, ctlTrend: 'rising' | 'stable' | 'falling'): TrainingPhase {
  if (tsb < -25) return 'recovery';
  if (tsb > 15 && ctlTrend === 'falling') return 'taper';
  if (tsb > -15) return 'build';   // rising OR stable — athlete can handle intensity
  return 'base';                   // TSB -15 to -25: moderately fatigued
}

/**
 * Calculate target TSS for the week given athlete's CTL and phase.
 */
export function targetWeeklyTSS(ctl: number, phase: TrainingPhase): { min: number; max: number } {
  const mult = PHASE_TSS_MULTIPLIERS[phase];
  return {
    min: Math.round(ctl * 7 * mult.min),
    max: Math.round(ctl * 7 * mult.max),
  };
}
