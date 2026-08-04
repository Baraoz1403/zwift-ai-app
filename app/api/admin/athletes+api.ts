/**
 * GET /api/admin/athletes
 *
 * Returns overview of all athletes for the coach dashboard.
 * Protected: only Barak's Zwift athlete ID can access this.
 *
 * Returns per athlete:
 *  - name, CTL, TSB, current phase
 *  - this week's plan (summary)
 *  - last feedback timestamp + note
 */

import type { GetAthletesResponse, ApiError } from '../../../lib/api/types';

const ADMIN_ZWIFT_ID = process.env.ADMIN_ZWIFT_ID;

export async function GET(request: Request): Promise<Response> {
  try {
    // TODO: verify token and extract athlete ID
    // const requesterId = await verifyToken(request.headers.get('Authorization'));

    // TODO: check admin access
    // if (requesterId !== ADMIN_ZWIFT_ID) {
    //   return Response.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    // }

    // TODO: load all athlete IDs from KV index
    // const athleteIds: string[] = await kv.get('athletes:index') ?? [];

    // TODO: for each athlete, load profile + current plan + last feedback
    // const athletes = await Promise.all(athleteIds.map(loadAthleteOverview));

    const stub: GetAthletesResponse = { athletes: [] };
    return Response.json(stub);
  } catch (err) {
    const error: ApiError = {
      error: 'Failed to load athletes',
      code: 'ADMIN_FETCH_FAILED',
      detail: process.env.NODE_ENV === 'development' ? String(err) : undefined,
    };
    return Response.json(error, { status: 500 });
  }
}
