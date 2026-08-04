/**
 * GET   /api/plan/:athleteId/:weekOf  — fetch existing plan from store
 * PATCH /api/plan/:athleteId/:weekOf  — coach applies partial day updates
 */

import type {
  GetPlanResponse,
  UpdatePlanRequest,
  UpdatePlanResponse,
  ApiError,
} from '../../../../lib/api/types';
import type { WeeklyPlan } from '../../../../lib/coaching/quality-gate';
import type { TrainingPhase } from '../../../../lib/knowledge/periodization';
import * as store from '../../../../lib/storage/store';

// ─── Stored plan shape ────────────────────────────────────────────────────────

interface StoredPlan {
  plan: WeeklyPlan;
  phase: TrainingPhase;
  wkg: number | null;
  generatedAt: string;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { athleteId, weekOf }: { athleteId: string; weekOf: string },
): Promise<Response> {
  if (!athleteId || !weekOf) {
    return Response.json(
      { error: 'Missing athleteId or weekOf', code: 'VALIDATION_ERROR' } satisfies ApiError,
      { status: 400 }
    );
  }

  try {
    const stored = await store.get<StoredPlan>(`plan:${athleteId}:${weekOf}`);

    const response: GetPlanResponse = {
      plan: stored?.plan ?? null,
      cachedAt: stored?.generatedAt,
    };
    return Response.json(response, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        error: 'Failed to fetch plan',
        code: 'FETCH_FAILED',
        detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      } satisfies ApiError,
      { status: 500 }
    );
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { athleteId, weekOf }: { athleteId: string; weekOf: string },
): Promise<Response> {
  if (!athleteId || !weekOf) {
    return Response.json(
      { error: 'Missing athleteId or weekOf', code: 'VALIDATION_ERROR' } satisfies ApiError,
      { status: 400 }
    );
  }

  let body: UpdatePlanRequest;
  try {
    body = await request.json() as UpdatePlanRequest;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' } satisfies ApiError,
      { status: 400 }
    );
  }

  try {
    const stored = await store.get<StoredPlan>(`plan:${athleteId}:${weekOf}`);
    if (!stored) {
      return Response.json(
        { error: 'No plan found for this week', code: 'NOT_FOUND' } satisfies ApiError,
        { status: 404 }
      );
    }

    // Apply partial updates — only touch the days specified
    const updatedWorkouts = stored.plan.workouts.map(w => {
      const update = body.updates.find(u => u.day === w.day);
      if (!update) return w;
      return { ...w, ...update };
    });

    const updatedPlan: WeeklyPlan = {
      ...stored.plan,
      workouts: updatedWorkouts,
      totalTSS: updatedWorkouts.reduce((s, w) => s + (w.estimatedTSS ?? 0), 0),
    };

    const updatedAt = new Date().toISOString();
    await store.set(
      `plan:${athleteId}:${weekOf}`,
      { ...stored, plan: updatedPlan, updatedAt } as unknown as Parameters<typeof store.set>[1]
    );

    const response: UpdatePlanResponse = { plan: updatedPlan, updatedAt };
    return Response.json(response, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        error: 'Failed to update plan',
        code: 'UPDATE_FAILED',
        detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      } satisfies ApiError,
      { status: 500 }
    );
  }
}
