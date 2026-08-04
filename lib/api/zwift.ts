/**
 * Zwift API client (clean wrapper for zwift-ai-app)
 * Logic extracted from the original project's lib/zwift.ts
 *
 * Auth: Zwift uses OAuth2 with username+password → Bearer token.
 * Token expires in ~1h, refresh via refresh_token.
 */

const ZWIFT_API = 'https://us-or-rly101.zwift.com/api';
const ZWIFT_AUTH = 'https://secure.zwift.com/auth/realms/zwift/protocol/openid-connect/token';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZwiftTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

export interface ZwiftProfile {
  id: number;
  firstName: string;
  lastName: string;
  imageSrc?: string;
  weight?: number;   // grams
  ftp?: number;
}

export interface ZwiftActivity {
  id: number;
  name: string;
  startDate: string;  // ISO
  distanceInMeters: number;
  durationInSeconds: number;
  avgWatts?: number;
  sportType?: string; // 'cycling' | 'running'
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Login with Zwift username + password → tokens.
 * Throws with a clear message on auth failure.
 */
export async function loginToZwift(username: string, password: string): Promise<ZwiftTokens> {
  const res = await fetch(ZWIFT_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'Zwift_Mobile_Link',
      grant_type: 'password',
      username,
      password,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || body.includes('invalid_grant')) {
      throw new Error('Invalid Zwift username or password.');
    }
    throw new Error(`Zwift login failed (${res.status})`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh expired access token using refresh_token.
 */
export async function refreshZwiftToken(refreshToken: string): Promise<ZwiftTokens> {
  const res = await fetch(ZWIFT_AUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'Zwift_Mobile_Link',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error('Session expired. Please log in again.');

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function fetchZwiftProfile(accessToken: string): Promise<ZwiftProfile> {
  const res = await fetch(`${ZWIFT_API}/profiles/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch Zwift profile (${res.status})`);
  return await res.json() as ZwiftProfile;
}

// ─── Activities ───────────────────────────────────────────────────────────────

/**
 * Fetch recent activities for an athlete.
 * Returns newest first.
 */
export async function fetchRecentActivities(
  accessToken: string,
  athleteId: number,
  limit = 20
): Promise<ZwiftActivity[]> {
  const res = await fetch(
    `${ZWIFT_API}/profiles/${athleteId}/activities?limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json() as ZwiftActivity[];
  return Array.isArray(data) ? data : [];
}
