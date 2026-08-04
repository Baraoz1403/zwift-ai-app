/**
 * Prompt Builder — assembles the full OpenAI system + user prompt from
 * structured knowledge sources. The AI never receives free-form coaching
 * rules: everything comes from TypeScript constants in lib/knowledge/.
 *
 * Design principle: the prompt is deterministic given the same inputs.
 * No magic strings. No coaching rules embedded in prompt text. If a rule
 * changes, it changes in lib/knowledge/, and the prompt automatically
 * reflects that.
 *
 * Output: { systemPrompt, userPrompt }
 * Both are injected into the OpenAI Chat Completions call in engine.ts.
 */

import {
  WORKOUT_LIBRARY_PROMPT,
  PHASE_GUIDELINES,
  PROGRESSION_LADDER,
  SESSION_PREREQUISITES,
  RIDER_LEVEL_THRESHOLDS,
} from '../knowledge/coaching-knowledge';

import {
  GOAL_LABELS,
  EXPERIENCE_LABELS,
  SESSION_LENGTH_MINUTES,
  DAYS_RANGE_MID,
  computeWkg,
  type RiderProfile,
} from '../knowledge/rider-profile';

import {
  PHASE_DEFINITIONS,
  determinePhase,
  targetWeeklyTSS,
  type TrainingPhase,
} from '../knowledge/periodization';

import {
  MAX_CONSECUTIVE_TRAINING_DAYS,
  MIN_REST_RECOVERY_DAYS_PER_WEEK,
  FORBIDDEN_WORKOUT_PATTERNS,
  MIN_INTERVAL_BLOCKS,
  DAY_TYPE_RULES,
} from '../knowledge/rules';

import type { TrainingLoadSummary } from './training-load';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface PromptContext {
  /** The athlete whose plan is being generated */
  profile: RiderProfile;

  /** Current training load state (from ICU or computed locally) */
  load: TrainingLoadSummary;

  /**
   * Previous week feedback, if any.
   * Optional — first plan generation will have none.
   */
  lastWeekFeedback?: WeekFeedback;

  /**
   * Force a specific phase (overrides auto-detection from TSB/CTL trend).
   * Useful for: recovery week mandate, pre-event taper, coach override.
   */
  phaseOverride?: TrainingPhase;

  /**
   * ISO date of the Monday this plan is for.
   * e.g. "2026-07-20"
   */
  weekOf: string;

  /**
   * Days of the week available for training (athlete's preference).
   * ["monday","wednesday","friday","saturday"] etc.
   * Derived from profile.daysRange + athlete's day preferences if set.
   */
  availableDays?: string[];

  /**
   * Optional: diagnostic message from a previous failed generation.
   * Injected into the retry prompt so the AI knows what went wrong.
   */
  retryDiagnostic?: string;
}

export interface WeekFeedback {
  /** Which days were completed */
  completedDays: string[];
  /** Which days were skipped */
  skippedDays: string[];
  /** Free text from athlete */
  notes?: string;
  /** Average RPE (1–10) for the week */
  avgRpe?: number;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  /** The phase that was determined (or overridden) */
  phase: TrainingPhase;
  /** W/kg used for workout selection gating */
  wkg: number | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function classifyRider(wkg: number | null): string {
  if (wkg === null) return 'Unknown (no FTP or weight data)';
  const match = RIDER_LEVEL_THRESHOLDS.find(t => wkg >= t.minWkg && wkg < t.maxWkg);
  return match ? `${match.label} (${wkg.toFixed(2)} W/kg) — ${match.note}` : `Elite (${wkg.toFixed(2)} W/kg)`;
}

function describeLoad(load: TrainingLoadSummary): string {
  const lines = [
    `CTL: ${load.ctl} (fitness base)`,
    `ATL: ${load.atl} (recent fatigue)`,
    `TSB: ${load.tsb} → ${load.freshness}`,
    `Rides last 7 days: ${load.ridesLast7Days} | Prior 7 days: ${load.ridesPrior7Days}`,
  ];
  return lines.join('\n');
}

function describePhase(phase: TrainingPhase): string {
  const def = PHASE_DEFINITIONS[phase];
  const guidelines = PHASE_GUIDELINES[
    phase.charAt(0).toUpperCase() + phase.slice(1) as keyof typeof PHASE_GUIDELINES
  ];
  const lines = [
    `Phase: ${phase.toUpperCase()}`,
    `Focus: ${def.focus}`,
  ];
  if (guidelines) {
    lines.push(`Preferred sessions: ${guidelines.primary.slice(0, 5).join(', ')}...`);
    if (guidelines.avoid.length > 0) {
      lines.push(`Forbidden this phase: ${(guidelines.avoid as readonly string[]).join(', ')}`);
    }
  }
  return lines.join('\n');
}

function describeTSSTarget(load: TrainingLoadSummary, phase: TrainingPhase): string {
  const target = targetWeeklyTSS(load.ctl, phase);
  return `Target weekly TSS: ${target.min}–${target.max} (based on CTL ${load.ctl})`;
}

function describeSessionReadiness(tsb: number): string {
  const lines: string[] = ['Session readiness from current TSB:'];
  for (const [category, prereq] of Object.entries(SESSION_PREREQUISITES)) {
    const ok = tsb >= prereq.minTsb;
    lines.push(`  ${ok ? '✓' : '✗'} ${category}: requires TSB ≥ ${prereq.minTsb}${ok ? '' : ` → fallback: "${prereq.fallback}"`}`);
  }
  return lines.join('\n');
}

function describeAvailableDays(profile: RiderProfile, availableDays?: string[]): string {
  const maxDays = DAYS_RANGE_MID[profile.daysRange];
  const sessionMin = SESSION_LENGTH_MINUTES[profile.sessionLength];

  if (availableDays && availableDays.length > 0) {
    return [
      `Available days: ${availableDays.join(', ')}`,
      `Max sessions this week: ${Math.floor(maxDays)} (athlete's configured range: ${profile.daysRange})`,
      `Session length: ${sessionMin} min (do not exceed by more than 15 min)`,
    ].join('\n');
  }

  return [
    `Training days per week: ${profile.daysRange} (use midpoint: ${maxDays} sessions)`,
    `Session length: ${sessionMin} min (do not exceed by more than 15 min)`,
    `Spread sessions to avoid consecutive hard days. Include ≥${MIN_REST_RECOVERY_DAYS_PER_WEEK} rest/recovery days.`,
  ].join('\n');
}

function describeFeedback(feedback?: WeekFeedback): string {
  if (!feedback) return 'No previous week feedback available.';
  const lines = ['Last week feedback:'];
  if (feedback.completedDays.length > 0) lines.push(`  Completed: ${feedback.completedDays.join(', ')}`);
  if (feedback.skippedDays.length > 0)   lines.push(`  Skipped: ${feedback.skippedDays.join(', ')}`);
  if (feedback.avgRpe !== undefined)      lines.push(`  Avg RPE: ${feedback.avgRpe}/10`);
  if (feedback.notes)                     lines.push(`  Notes: "${feedback.notes}"`);
  return lines.join('\n');
}

// ─── Quality gate rules in plain language (for the AI to understand) ─────────

const QUALITY_GATE_EXPLANATION = `
QUALITY GATE (your output will be rejected if any of these fail):
1. Every TRAINING day must have ≥${MIN_INTERVAL_BLOCKS} interval blocks (warmup + intervals + cooldown).
2. Forbidden workout names on training days: ${FORBIDDEN_WORKOUT_PATTERNS.join(', ')}.
3. No more than ${MAX_CONSECUTIVE_TRAINING_DAYS} consecutive training days without a rest/recovery day.
4. Weekly TSS must be within the stated target range.
5. Day type rules:
   - training: ${DAY_TYPE_RULES.training}
   - recovery: ${DAY_TYPE_RULES.recovery}
   - rest: ${DAY_TYPE_RULES.rest}
`.trim();

// ─── Output format spec ───────────────────────────────────────────────────────

const OUTPUT_FORMAT = `
REQUIRED OUTPUT FORMAT — respond with valid JSON only, no markdown fences:

{
  "weekOf": "YYYY-MM-DD",
  "phase": "base|build|taper|race|recovery",
  "targetTSS": 350,
  "workouts": [
    {
      "day": "monday",
      "dayType": "training|recovery|rest",
      "workoutName": "Sweet Spot Classic",
      "workoutType": "sweet-spot",
      "estimatedTSS": 78,
      "durationMin": 60,
      "rationale": "One sentence: why this session for this athlete today.",
      "executionCue": "The one thing that makes or breaks this session.",
      "blocks": [
        { "type": "warmup",      "durationMin": 10, "powerPct": 0.70, "label": "Easy warm-up" },
        { "type": "intervals",   "durationMin": 30, "powerPct": 0.90, "reps": 3, "onSec": 600, "offSec": 240, "recoveryPct": 0.52, "label": "3×10 min @ 90% FTP" },
        { "type": "cooldown",    "durationMin": 10, "powerPct": 0.55, "label": "Easy cool-down" }
      ]
    }
  ]
}

Rules for blocks:
- "type" must be one of: warmup, intervals, steady, cooldown
- "powerPct" is a decimal fraction of FTP (0.90 = 90% FTP)
- For "intervals" blocks: include reps, onSec, offSec, recoveryPct
- For "rest" days: workouts array entry has dayType "rest", no blocks, no workoutName
- For "recovery" days: one block only (steady Z1), powerPct ≤ 0.60
- Every training day must have exactly one warmup block, ≥1 intervals block, one cooldown block
`.trim();

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildPrompt(ctx: PromptContext): BuiltPrompt {
  const { profile, load, lastWeekFeedback, phaseOverride, weekOf, availableDays, retryDiagnostic } = ctx;

  // Determine training phase
  // Derive CTL trend from ATL vs CTL ratio — much more accurate than ride count.
  // ATL >> CTL means athlete is loading heavily (fitness rising).
  // ATL << CTL means athlete is de-loading (fitness falling).
  const atlCtlRatio = load.ctl > 0 ? load.atl / load.ctl : 1;
  const ctlTrend: 'rising' | 'stable' | 'falling' =
    atlCtlRatio > 1.05 ? 'rising'
    : atlCtlRatio < 0.90 ? 'falling'
    : 'stable';

  const phase: TrainingPhase = phaseOverride ?? determinePhase(load.tsb, ctlTrend);
  const wkg = computeWkg(profile.ftp, profile.weightKg);

  // ── System prompt ──────────────────────────────────────────────────────────

  const systemPrompt = [
    '# Role',
    'You are an elite cycling coach AI. You generate structured weekly training plans.',
    'You know every athlete by name and by data. You are precise, evidence-based, and never vague.',
    '',
    '# Core Principles',
    '- Every workout is built block by block: warmup → intervals → cooldown.',
    '- Every session name must come from the Named Workout Protocols list below.',
    '- Power targets are exact percentages of FTP, never rounded to "about 90%".',
    '- Plans are physiologically justified — not templates with changed numbers.',
    '- The workout library is canon. You cannot invent new workout names.',
    '',
    '# Workout Library',
    WORKOUT_LIBRARY_PROMPT,
    '',
    '# Progression Ladder',
    'Never skip rungs. Advance one rung at a time:',
    PROGRESSION_LADDER.join(' → '),
    '',
    QUALITY_GATE_EXPLANATION,
    '',
    OUTPUT_FORMAT,
  ].join('\n');

  // ── User prompt ────────────────────────────────────────────────────────────

  const userPromptSections = [
    `# Athlete: ${profile.name}`,
    `Week of: ${weekOf}`,
    '',
    '## Profile',
    `FTP: ${profile.ftp ? `${profile.ftp}W` : 'unknown'}`,
    `Weight: ${profile.weightKg ? `${profile.weightKg} kg` : 'unknown'}`,
    `Rider classification: ${classifyRider(wkg)}`,
    `Experience: ${EXPERIENCE_LABELS[profile.experienceLevel]}`,
    `Goals: ${profile.goals.map(g => GOAL_LABELS[g]).join(', ')}`,
    profile.eventDate ? `Target event: ${profile.eventDate}` : '',
    profile.notes ? `Coach notes: ${profile.notes}` : '',
    '',
    '## Current Training Load',
    describeLoad(load),
    '',
    '## Phase & Targets',
    describePhase(phase),
    describeTSSTarget(load, phase),
    '',
    '## Session Readiness',
    describeSessionReadiness(load.tsb),
    '',
    '## Schedule',
    describeAvailableDays(profile, availableDays),
    '',
    '## Last Week',
    describeFeedback(lastWeekFeedback),
  ].filter(Boolean);

  // Inject retry diagnostic if this is a retry call
  if (retryDiagnostic) {
    userPromptSections.push('');
    userPromptSections.push('## ⚠️ Previous Generation Failed');
    userPromptSections.push(retryDiagnostic);
    userPromptSections.push('Fix ALL failures listed above. Do not repeat these mistakes.');
  }

  userPromptSections.push('');
  userPromptSections.push('Generate the weekly training plan as JSON.');

  return {
    systemPrompt,
    userPrompt: userPromptSections.join('\n'),
    phase,
    wkg,
  };
}
