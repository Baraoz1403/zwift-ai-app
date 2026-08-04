/**
 * Intervals.icu API client (clean wrapper for zwift-ai-app)
 * Logic extracted from the original project's lib/intervals.ts
 *
 * Auth: HTTP Basic — username "API_KEY", password = the key itself.
 * No approval process. Key generated at intervals.icu/settings → Developer Settings.
 */

const INTERVALS_API = 'https://intervals.icu/api/v1';

/** Base64 encode — safe for all characters on both web and Node */
function toBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64');
  }
  // Web: encode to UTF-8 bytes first, then base64
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

/** Basic auth using API key (personal use / fallback) */
function basicAuth(apiKey: string): string {
  return 'Basic ' + toBase64(`API_KEY:${apiKey}`);
}

/** Bearer auth using OAuth access token */
function bearerAuth(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Build Authorization header from stored credentials.
 * Accepts either a Bearer token (OAuth) or an API key (Basic auth).
 * Pass `{ token }` for OAuth, `{ apiKey }` for API-key flow.
 */
export function buildAuthHeader(creds: { token?: string; apiKey?: string }): string {
  if (creds.token) return bearerAuth(creds.token);
  if (creds.apiKey) return basicAuth(creds.apiKey);
  throw new Error('No ICU credentials supplied');
}

function toSportType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('run')) return 'Run';
  if (t.includes('swim')) return 'Swim';
  if (t.includes('walk')) return 'Walk';
  return 'Ride';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ICUAthlete {
  id?: string | number;
  name?: string;
  email?: string;
}

export interface ICUFitnessData {
  ctl: number;   // Chronic Training Load
  atl: number;   // Acute Training Load
  tsb: number;   // Training Stress Balance (CTL - ATL)
}

export interface PushWorkoutOptions {
  apiKey: string;
  athleteId?: string;
  date: string;          // YYYY-MM-DD
  title: string;
  description?: string;
  durationMin: number;
  sportType: string;     // 'cycling' | 'running'
  zwoXml: string;        // Full .zwo XML
  tssPlanned?: number;
}

export interface PushWorkoutResult {
  ok: boolean;
  eventId?: string | number;
  error?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Validate ICU credentials and return athlete profile.
 * Accepts either OAuth access token or API key.
 * Throws with a clear message on auth failure.
 */
export async function fetchICUAthlete(
  creds: string | { token?: string; apiKey?: string }
): Promise<ICUAthlete> {
  const authHeader = typeof creds === 'string'
    ? basicAuth(creds)  // backward-compat: raw API key string
    : buildAuthHeader(creds);

  for (const endpoint of ['/athlete/me', '/athlete/0']) {
    try {
      const res = await fetch(`${INTERVALS_API}${endpoint}`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });

      if (res.ok) return await res.json() as ICUAthlete;

      if (res.status === 401 || res.status === 403) {
        throw new Error('Invalid Intervals.icu credentials. Check your username and password.');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Invalid')) throw e;
      // Network error — try next endpoint
    }
  }
  return {}; // Both endpoints failed for non-auth reasons
}

// ─── Fitness data ─────────────────────────────────────────────────────────────

/**
 * Fetch current CTL, ATL, TSB for an athlete.
 */
export async function fetchFitness(
  creds: string | { token?: string; apiKey?: string },
  athleteId: string
): Promise<ICUFitnessData | null> {
  const authHeader = typeof creds === 'string' ? basicAuth(creds) : buildAuthHeader(creds);
  try {
    const res = await fetch(`${INTERVALS_API}/athlete/${athleteId}/fitness`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { ctl?: number; atl?: number; form?: number };
    return {
      ctl: data.ctl ?? 0,
      atl: data.atl ?? 0,
      tsb: data.form ?? 0,
    };
  } catch {
    return null;
  }
}

// ─── Recent activities ────────────────────────────────────────────────────────

export interface ICUActivity {
  id: string | number;
  /** ISO date "YYYY-MM-DD" */
  start_date_local: string;
  type: string;
  icu_training_load?: number;
}

/**
 * Fetch recent activities for ride-count computation (ATL/CTL proxy).
 * Returns an empty array on any error — callers should degrade gracefully.
 */
export async function fetchRecentActivities(
  creds: string | { token?: string; apiKey?: string },
  athleteId: string,
  days = 14
): Promise<ICUActivity[]> {
  const authHeader = typeof creds === 'string' ? basicAuth(creds) : buildAuthHeader(creds);
  try {
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - days);
    const url = `${INTERVALS_API}/athlete/${athleteId}/activities?oldest=${oldest.toISOString().slice(0, 10)}`;
    const res = await fetch(url, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as ICUActivity[]) : [];
  } catch {
    return [];
  }
}

// ─── Workout upload ───────────────────────────────────────────────────────────

/**
 * Push a structured workout to ICU calendar as a .zwo entry.
 * Cycling → type "Ride" | Running → type "Run"
 */
export async function pushWorkout(opts: PushWorkoutOptions): Promise<PushWorkoutResult> {
  const safeName = opts.title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'workout';

  const body = {
    category: 'WORKOUT',
    start_date_local: `${opts.date}T00:00:00`,
    type: toSportType(opts.sportType),
    name: opts.title,
    description: opts.description ?? '',
    filename: `${opts.date}-${safeName}.zwo`,
    file_contents: opts.zwoXml,
    moving_time: Math.round(opts.durationMin * 60),
    ...(opts.tssPlanned ? { icu_training_load: Math.round(opts.tssPlanned) } : {}),
  };

  try {
    const res = await fetch(`${INTERVALS_API}/athlete/${opts.athleteId ?? 'me'}/events`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(opts.apiKey),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text().catch(() => '');
    if (res.ok) {
      const parsed = JSON.parse(text) as { id?: string | number };
      return { ok: true, eventId: parsed.id };
    }
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
