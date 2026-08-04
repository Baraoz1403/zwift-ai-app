/**
 * POST /api/auth/icu/token
 *
 * Server-side token exchange for Intervals.icu OAuth.
 * Keeps ICU_CLIENT_SECRET off the client.
 *
 * Body: { code: string, redirectUri: string }
 * Returns: { access_token: string, athlete: { id: string, name: string } }
 */

import { ExpoRequest, ExpoResponse } from 'expo-router/server';

const CLIENT_ID     = process.env.ICU_CLIENT_ID     ?? '';
const CLIENT_SECRET = process.env.ICU_CLIENT_SECRET ?? '';

export async function POST(request: ExpoRequest): Promise<ExpoResponse> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return ExpoResponse.json(
      { error: 'ICU OAuth not configured. Set ICU_CLIENT_ID and ICU_CLIENT_SECRET in .env.local.' },
      { status: 503 }
    );
  }

  let body: { code?: string; redirectUri?: string };
  try {
    body = await request.json() as { code?: string; redirectUri?: string };
  } catch {
    return ExpoResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { code, redirectUri } = body;
  if (!code || !redirectUri) {
    return ExpoResponse.json({ error: 'Missing code or redirectUri' }, { status: 400 });
  }

  // Exchange code for Bearer token on the server (client_secret never leaves here)
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri:  redirectUri,
  });

  const tokenRes = await fetch('https://intervals.icu/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json() as {
    access_token?: string;
    error?: string;
    athlete?: { id: string; name: string };
  };

  if (!tokenRes.ok || !tokenData.access_token) {
    return ExpoResponse.json(
      { error: tokenData.error ?? `ICU token exchange failed (HTTP ${tokenRes.status})` },
      { status: 400 }
    );
  }

  return ExpoResponse.json({
    access_token: tokenData.access_token,
    athlete:      tokenData.athlete ?? {},
  });
}
