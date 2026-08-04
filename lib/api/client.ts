/**
 * API client — typed wrappers around every server endpoint.
 *
 * Base URL:
 *   dev  → http://localhost:8081  (Expo dev server)
 *   prod → process.env.EXPO_PUBLIC_API_URL  (set in eas.json / .env)
 *
 * Profile & athlete ID are read from AsyncStorage by the helpers below.
 * ICU credentials are stored under 'auth:icuApiKey' and 'auth:icuAthleteId'.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  GeneratePlanRequest,
  GeneratePlanResponse,
  GetPlanResponse,
  PostFeedbackRequest,
  PostFeedbackResponse,
  SaveProfileRequest,
  SaveProfileResponse,
  GetProfileResponse,
} from './types';
import type { RiderProfile } from '../knowledge/rider-profile';
import type { TrainingPhase } from '../knowledge/periodization';

// ─── Base URL ─────────────────────────────────────────────────────────────────

import { apiBase } from './client-internal';
export { apiBase } from './client-internal';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const text = await res.text();
  let json: T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    // API routes not available in web SPA mode — return empty rather than crash
    throw new ApiClientError(
      'API not available in web mode',
      'WEB_MODE',
      0
    );
  }
  if (!res.ok) {
    const err = json as { error?: string; code?: string };
    throw new ApiClientError(err.error ?? 'Request failed', err.code ?? 'UNKNOWN', res.status);
  }
  return json;
}

// ─── AsyncStorage keys ────────────────────────────────────────────────────────

const KEY_ATHLETE_ID     = 'auth:athleteId';
const KEY_PROFILE        = 'auth:profile';
const KEY_ICU_API_KEY    = 'auth:icuApiKey';
const KEY_ICU_ATHLETE_ID = 'auth:icuAthleteId';
const KEY_ICU_TOKEN      = 'auth:icuToken';   // OAuth Bearer token (preferred)

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function getAthleteId(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_ATHLETE_ID);
}

export async function saveAthleteId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEY_ATHLETE_ID, id);
}

export async function getStoredProfile(): Promise<RiderProfile | null> {
  const raw = await AsyncStorage.getItem(KEY_PROFILE);
  if (!raw) return null;
  try { return JSON.parse(raw) as RiderProfile; } catch { return null; }
}

export async function saveProfileLocally(profile: RiderProfile): Promise<void> {
  await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
  await AsyncStorage.setItem(KEY_ATHLETE_ID, profile.athleteId);
}

export async function getIcuCredentials(): Promise<{
  token?: string;
  apiKey?: string;
  athleteId: string;
} | null> {
  const [token, apiKey, athleteId] = await Promise.all([
    AsyncStorage.getItem(KEY_ICU_TOKEN),
    AsyncStorage.getItem(KEY_ICU_API_KEY),
    AsyncStorage.getItem(KEY_ICU_ATHLETE_ID),
  ]);
  if (!token && !apiKey) return null;
  return { token: token ?? undefined, apiKey: apiKey ?? undefined, athleteId: athleteId ?? '0' };
}

/** Save OAuth Bearer token (preferred path — from OAuth login) */
export async function saveIcuToken(token: string, athleteId: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEY_ICU_TOKEN, token),
    AsyncStorage.setItem(KEY_ICU_ATHLETE_ID, athleteId),
    AsyncStorage.setItem(KEY_ATHLETE_ID, athleteId),
  ]);
}

/** Save API key (fallback path — from manual entry) */
export async function saveIcuCredentials(apiKey: string, athleteId: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEY_ICU_API_KEY, apiKey),
    AsyncStorage.setItem(KEY_ICU_ATHLETE_ID, athleteId),
  ]);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getMondayISO(d: Date = new Date()): string {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function getTodayDayName(): string {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    new Date().getDay()
  ];
}

// ─── Profile API ──────────────────────────────────────────────────────────────

export async function fetchProfile(athleteId: string): Promise<RiderProfile | null> {
  const res = await apiFetch<GetProfileResponse>(`/api/profile?athleteId=${encodeURIComponent(athleteId)}`);
  return res.profile;
}

export async function saveProfile(profile: SaveProfileRequest): Promise<SaveProfileResponse> {
  const res = await apiFetch<SaveProfileResponse>('/api/profile', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
  // Mirror to local storage
  await saveProfileLocally(res.profile);
  return res;
}

// ─── Plan API ─────────────────────────────────────────────────────────────────

export async function loadPlan(athleteId: string, weekOf: string): Promise<GetPlanResponse> {
  return apiFetch<GetPlanResponse>(`/api/plan/${encodeURIComponent(athleteId)}/${encodeURIComponent(weekOf)}`);
}

export async function generatePlan(opts: {
  athleteId: string;
  weekOf: string;
  profile: RiderProfile;
  phaseOverride?: TrainingPhase;
  availableDays?: string[];
  icuApiKey?: string;
  icuAthleteId?: string;
}): Promise<GeneratePlanResponse> {
  const body: GeneratePlanRequest = {
    athleteId:    opts.athleteId,
    weekOf:       opts.weekOf,
    profile:      opts.profile,
    phaseOverride: opts.phaseOverride,
    availableDays: opts.availableDays,
    icuApiKey:    opts.icuApiKey,
    icuAthleteId: opts.icuAthleteId,
  };
  return apiFetch<GeneratePlanResponse>('/api/plan/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ─── Feedback API ─────────────────────────────────────────────────────────────

export async function submitFeedback(fb: PostFeedbackRequest): Promise<PostFeedbackResponse> {
  return apiFetch<PostFeedbackResponse>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(fb),
  });
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}
