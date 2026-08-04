/**
 * POST /api/feedback
 *
 * Saves post-workout feedback and evaluates whether a plan adjustment
 * is warranted for the remaining days of the week.
 *
 * Adjustment logic (deterministic — no AI call):
 *   - ≥2 sessions skipped this week → reduce load
 *   - avgRPE ≥ 9                   → reduce intensity next session
 *   - avgRPE ≤ 4 + all completed   → ready to progress
 *
 * Storage keys:
 *   feedback:{athleteId}:{weekOf}:{day}  → PostFeedbackRequest
 *   feedback:{athleteId}:{weekOf}:index  → string[] of days with feedback
 */

import type { PostFeedbackRequest, PostFeedbackResponse, ApiError } from '../../lib/api/types';
import * as store from '../../lib/storage/store';

// ─── Adjustment logic ─────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface FeedbackAdjustment {
  description: string;
  updatedDays: string[];
}

function evaluateAdjustment(
  allFeedback: PostFeedbackRequest[],
  currentDay: string,
): FeedbackAdjustment | undefined {
  const skipped   = allFeedback.filter(f => !f.completed);
  const completed = allFeedback.filter(f => f.completed);
  const rpeValues = allFeedback.map(f => f.rpe).filter((r): r is number => r !== undefined);
  const avgRpe    = rpeValues.length > 0
    ? rpeValues.reduce((s, r) => s + r, 0) / rpeValues.length
    : null;

  // Remaining training days (after current day)
  const currentIdx = DAYS_OF_WEEK.indexOf(currentDay.toLowerCase());
  const remainingDays = currentIdx >= 0
    ? DAYS_OF_WEEK.slice(currentIdx + 1)
    : [];

  // ── Rule 1: Too many skipped → reduce load ────────────────────────────────
  if (skipped.length >= 2 && remainingDays.length > 0) {
    return {
      description: `Athlete missed ${skipped.length} sessions this week. Recommend reducing load for remaining days — prioritize recovery and one quality session only.`,
      updatedDays: remainingDays,
    };
  }

  // ── Rule 2: High RPE → reduce next session's intensity ───────────────────
  if (avgRpe !== null && avgRpe >= 9 && remainingDays.length > 0) {
    return {
      description: `Average RPE ${avgRpe.toFixed(1)}/10 — training stress is high. Recommend reducing intensity of next session to recovery pace (Z1-Z2).`,
      updatedDays: [remainingDays[0]],
    };
  }

  // ── Rule 3: All completed + low RPE → athlete can progress ───────────────
  const weekDaysSoFar = allFeedback.length;
  if (avgRpe !== null && avgRpe <= 4 && completed.length === weekDaysSoFar && weekDaysSoFar >= 2) {
    return {
      description: `RPE ${avgRpe.toFixed(1)}/10 with full compliance — athlete is handling load well. Consider advancing one rung on the progression ladder next week.`,
      updatedDays: [],
    };
  }

  return undefined;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: PostFeedbackRequest;
  try {
    body = await request.json() as PostFeedbackRequest;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' } satisfies ApiError,
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.athleteId || !body.weekOf || !body.day) {
    return Response.json(
      { error: 'Missing required fields: athleteId, weekOf, day', code: 'VALIDATION_ERROR' } satisfies ApiError,
      { status: 400 }
    );
  }
  if (body.rpe !== undefined && (body.rpe < 1 || body.rpe > 10)) {
    return Response.json(
      { error: 'rpe must be between 1 and 10', code: 'VALIDATION_ERROR' } satisfies ApiError,
      { status: 400 }
    );
  }

  try {
    const feedbackKey = `feedback:${body.athleteId}:${body.weekOf}:${body.day}`;
    const indexKey    = `feedback:${body.athleteId}:${body.weekOf}:index`;

    // Save this day's feedback
    await store.set(feedbackKey, body as unknown as Parameters<typeof store.set>[1]);

    // Update the week's feedback index
    await store.sadd(indexKey, body.day);

    // Load all feedback for this week to evaluate adjustment
    const feedbackDays = await store.smembers(indexKey);
    const feedbackKeys = feedbackDays.map(
      day => `feedback:${body.athleteId}:${body.weekOf}:${day}`
    );
    const allFeedbackRaw = await store.getMany<PostFeedbackRequest>(feedbackKeys);
    const allFeedback = allFeedbackRaw.filter((f): f is PostFeedbackRequest => f !== null);

    const adjustment = evaluateAdjustment(allFeedback, body.day);

    const response: PostFeedbackResponse = {
      saved: true,
      planAdjustment: adjustment,
    };

    return Response.json(response, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        error: 'Failed to save feedback',
        code: 'FEEDBACK_FAILED',
        detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      } satisfies ApiError,
      { status: 500 }
    );
  }
}
