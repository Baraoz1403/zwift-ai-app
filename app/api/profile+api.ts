/**
 * GET  /api/profile?athleteId=xxx — fetch stored athlete profile
 * POST /api/profile               — save / update profile (from onboarding or settings)
 *
 * Storage: lib/storage/store.ts
 *   dev  → .data/store.json (file-based, auto-created)
 *   prod → Vercel KV (set KV_REST_API_URL + KV_REST_API_TOKEN)
 *
 * Key schema:
 *   profile:{athleteId}  → RiderProfile JSON
 *   athletes:index       → set of athleteIds (for admin listing)
 */

import type {
  GetProfileResponse,
  SaveProfileRequest,
  SaveProfileResponse,
  ApiError,
} from '../../lib/api/types';
import type { RiderProfile } from '../../lib/knowledge/rider-profile';
import * as store from '../../lib/storage/store';

// ─── GET /api/profile?athleteId=xxx ──────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const athleteId = url.searchParams.get('athleteId');

  if (!athleteId) {
    return Response.json(
      { error: 'Missing athleteId query param', code: 'VALIDATION_ERROR' } satisfies ApiError,
      { status: 400 }
    );
  }

  try {
    const profile = await store.get<RiderProfile>(`profile:${athleteId}`);
    const response: GetProfileResponse = { profile };
    return Response.json(response, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        error: 'Failed to fetch profile',
        code: 'PROFILE_FETCH_FAILED',
        detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      } satisfies ApiError,
      { status: 500 }
    );
  }
}

// ─── POST /api/profile ────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  let body: SaveProfileRequest;
  try {
    body = await request.json() as SaveProfileRequest;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' } satisfies ApiError,
      { status: 400 }
    );
  }

  if (!body.athleteId) {
    return Response.json(
      { error: 'Missing athleteId', code: 'VALIDATION_ERROR' } satisfies ApiError,
      { status: 400 }
    );
  }
  if (!body.name || typeof body.name !== 'string') {
    return Response.json(
      { error: 'Missing or invalid name', code: 'VALIDATION_ERROR' } satisfies ApiError,
      { status: 400 }
    );
  }

  const profile: RiderProfile = {
    athleteId:      body.athleteId,
    name:           body.name,
    email:          body.email,
    ftp:            body.ftp,
    thresholdPace:  body.thresholdPace,
    weightKg:       body.weightKg,
    goals:          body.goals          ?? ['fitness'],
    experienceLevel: body.experienceLevel ?? 'intermediate',
    daysRange:      body.daysRange       ?? '3-4',
    sessionLength:  body.sessionLength   ?? '60',
    sports:         body.sports          ?? ['cycling'],
    environment:    body.environment,
    ageYears:       body.ageYears,
    eventDate:      body.eventDate,
    notes:          body.notes,
  };

  try {
    // Save profile
    await store.set(`profile:${body.athleteId}`, profile as unknown as Parameters<typeof store.set>[1]);

    // Add to athletes index (idempotent)
    await store.sadd('athletes:index', body.athleteId);

    const response: SaveProfileResponse = { saved: true, profile };
    return Response.json(response, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error: 'Failed to save profile',
        code: 'PROFILE_SAVE_FAILED',
        detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      } satisfies ApiError,
      { status: 500 }
    );
  }
}
