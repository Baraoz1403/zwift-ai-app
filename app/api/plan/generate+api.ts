/**
 * POST /api/plan/generate
 *
 * Generates a structured weekly training plan with interval emphasis.
 *
 * Flow:
 *  1. Parse request (profile + optional ICU credentials inline)
 *  2. Fetch ICU fitness data (CTL / ATL / TSB) — or use safe defaults
 *  3. Fetch recent activity counts (ridesLast7/14Days)
 *  4. Call coaching engine → generateWeeklyPlan() with quality gate
 *  5. Upload each training day to ICU calendar as a .zwo workout
 *  6. Return the validated plan
 *
 * Stateless design: no KV required. The client sends the profile inline.
 * When KV is configured later, move to profile lookup by athleteId.
 */

import type { GeneratePlanRequest, GeneratePlanResponse, ApiError } from '../../../lib/api/types';
import { generateWeeklyPlan, EngineError } from '../../../lib/coaching/engine';
import { fetchFitness, fetchRecentActivities, pushWorkout } from '../../../lib/api/icu';
import type { TrainingLoadSummary } from '../../../lib/coaching/training-load';
import type { WorkoutBlock } from '../../../lib/coaching/quality-gate';
import {
  generateZwoXml,
  structureToBlocks,
  type WorkoutStructureBlock,
} from '../../../lib/zwo';
import * as store from '../../../lib/storage/store';

// ─── Day-of-week helpers ──────────────────────────────────────────────────────

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function dayDate(weekOf: string, dayName: string): string {
  const idx = DAY_NAMES.indexOf(dayName.toLowerCase());
  if (idx === -1) return weekOf;
  const d = new Date(weekOf);
  d.setUTCDate(d.getUTCDate() + idx);
  return d.toISOString().slice(0, 10);
}

// ─── Block conversion ─────────────────────────────────────────────────────────

/**
 * Convert the AI's DayWorkout blocks (typed via WorkoutBlock, but at runtime
 * the JSON carries extra fields: reps, onSec, offSec, recoveryPct, label)
 * into the ZWO WorkoutStructureBlock shape used by zwo.ts.
 */
function toZwoStructure(blocks: WorkoutBlock[] | undefined): WorkoutStructureBlock[] {
  if (!blocks?.length) return [];

  return blocks.map((b) => {
    // Runtime AI JSON has extra fields not captured in the WorkoutBlock interface
    const raw = b as WorkoutBlock & {
      recoveryPct?: number;
      reps?: number;
      onSec?: number;
      offSec?: number;
      label?: string;
    };

    // Map 'steady' (prompt output name) → 'steadystate' (zwo.ts enum value)
    const type = (b.type as string) === 'steady' ? 'steadystate' : b.type;

    return {
      type: type as WorkoutStructureBlock['type'],
      durationMin: b.durationMin,
      powerFtp: b.powerPct ?? 0.65,
      recoveryPowerFtp: raw.recoveryPct,
      repeats: raw.reps,
      onSec: raw.onSec,
      offSec: raw.offSec,
      label: raw.label ?? b.type,
    } satisfies WorkoutStructureBlock;
  });
}

// ─── Extended workout shape (fields AI includes beyond the typed interface) ───

interface DayWorkoutExtended {
  day: string;
  dayType: 'training' | 'recovery' | 'rest';
  workoutName?: string;
  workoutType?: string;
  blocks?: WorkoutBlock[];
  estimatedTSS?: number;
  durationMin?: number;
  rationale?: string;
  executionCue?: string;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return Response.json(
      { error: 'Server misconfigured: ANTHROPIC_API_KEY missing', code: 'CONFIG_ERROR' } satisfies ApiError,
      { status: 500 }
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────────

  let body: GeneratePlanRequest;
  try {
    body = await request.json() as GeneratePlanRequest;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' } satisfies ApiError,
      { status: 400 }
    );
  }

  // ── 1. Validate profile ─────────────────────────────────────────────────────

  const profile = body.profile;
  if (!profile) {
    return Response.json(
      { error: 'profile is required in the request body', code: 'MISSING_PROFILE' } satisfies ApiError,
      { status: 400 }
    );
  }
  if (!body.weekOf || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekOf)) {
    return Response.json(
      { error: 'weekOf must be a Monday date string (YYYY-MM-DD)', code: 'BAD_REQUEST' } satisfies ApiError,
      { status: 400 }
    );
  }

  // ── 2. ICU credentials ──────────────────────────────────────────────────────

  const icuToken  = body.icuToken  ?? '';
  const icuApiKey = body.icuApiKey ?? (process.env.ICU_API_KEY ?? '');
  const icuAthleteId = body.icuAthleteId ?? body.athleteId;
  // Use whichever credential is available — token takes precedence
  const icuCreds = icuToken ? { token: icuToken } : icuApiKey ? icuApiKey : null;

  // ── 3. Training load ────────────────────────────────────────────────────────

  let load: TrainingLoadSummary;

  if (icuCreds) {
    // Fetch fitness metrics and recent activities in parallel
    const [fitness, recentActivities] = await Promise.all([
      fetchFitness(icuCreds, icuAthleteId),
      fetchRecentActivities(icuCreds, icuAthleteId, 14),
    ]);

    const ctl = fitness?.ctl ?? 0;
    const atl = fitness?.atl ?? 0;
    const tsb = fitness?.tsb ?? 0;

    const MS_PER_DAY = 86_400_000;
    const now = Date.now();
    const ridesLast7Days  = recentActivities.filter(a => {
      const age = (now - new Date(a.start_date_local).getTime()) / MS_PER_DAY;
      return age >= 0 && age < 7;
    }).length;
    const ridesPrior7Days = recentActivities.filter(a => {
      const age = (now - new Date(a.start_date_local).getTime()) / MS_PER_DAY;
      return age >= 7 && age < 14;
    }).length;

    load = {
      ctl,
      atl,
      tsb,
      freshness: tsb > 5 ? 'fresh' : tsb < -5 ? 'fatigued' : 'neutral',
      ridesLast7Days,
      ridesPrior7Days,
    };
  } else {
    // Safe defaults for first run / development without ICU
    load = {
      ctl: 40,
      atl: 40,
      tsb: 0,
      freshness: 'neutral',
      ridesLast7Days: 3,
      ridesPrior7Days: 3,
    };
  }

  // ── 4. Generate plan ────────────────────────────────────────────────────────

  let result;
  try {
    result = await generateWeeklyPlan(
      {
        profile,
        load,
        weekOf: body.weekOf,
        phaseOverride: body.phaseOverride,
        availableDays: body.availableDays,
      },
      { anthropicApiKey }
    );
  } catch (err) {
    if (err instanceof EngineError) {
      return Response.json(
        {
          error: err.message,
          code: err.code,
          detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
        } satisfies ApiError,
        { status: 500 }
      );
    }
    return Response.json(
      {
        error: 'Plan generation failed',
        code: 'GENERATE_FAILED',
        detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      } satisfies ApiError,
      { status: 500 }
    );
  }

  // ── 5. Upload training days to ICU calendar ─────────────────────────────────

  if (icuCreds) {
    const trainingDays = (result.plan.workouts as DayWorkoutExtended[]).filter(
      w => w.dayType === 'training'
    );

    // Fire-and-forget: failures are logged but don't block the response
    await Promise.allSettled(
      trainingDays.map(async (w) => {
        const structure = toZwoStructure(w.blocks);
        const zwoBlocks = structure.length > 0 ? structureToBlocks(structure) : undefined;

        const description = [
          w.rationale  ? `Why: ${w.rationale}`  : '',
          w.executionCue ? `Key: ${w.executionCue}` : '',
        ].filter(Boolean).join('\n');

        const zwoInput = {
          title: w.workoutName ?? 'Training',
          type: w.workoutType ?? 'intervals',
          durationMin: w.durationMin ?? 60,
          description,
          structure: structure.length > 0 ? structure : undefined,
        };

        const zwoXml = generateZwoXml(zwoInput, zwoBlocks, 'Zwift AI Coach');

        return pushWorkout({
          ...(typeof icuCreds === 'string' ? { apiKey: icuCreds } : icuCreds),
          athleteId: icuAthleteId,
          date: dayDate(body.weekOf, w.day),
          title: w.workoutName ?? 'Training',
          description,
          durationMin: zwoInput.durationMin,
          sportType: w.workoutType?.includes('run') ? 'running' : 'cycling',
          zwoXml,
          tssPlanned: w.estimatedTSS,
        });
      })
    );
  }

  // ── 6. Persist plan to store ────────────────────────────────────────────────

  await store.set(
    `plan:${body.athleteId}:${body.weekOf}`,
    {
      plan: result.plan,
      phase: result.phase,
      wkg: result.wkg,
      generatedAt: new Date().toISOString(),
    } as unknown as Parameters<typeof store.set>[1]
  );

  // ── 7. Return ───────────────────────────────────────────────────────────────

  const response: GeneratePlanResponse = {
    plan: result.plan,
    phase: result.phase,
    wkg: result.wkg,
    retries: result.retries,
    generatedAt: new Date().toISOString(),
  };

  return Response.json(response, { status: 200 });
}
