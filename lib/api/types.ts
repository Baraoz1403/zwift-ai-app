/**
 * Shared API types — request and response shapes for all backend endpoints.
 *
 * These types are used by:
 *  - app/api/ route handlers (server side)
 *  - lib/api/ client functions (called from the mobile app)
 *
 * Keeping them here (not duplicated in both places) is the contract.
 */

import type { WeeklyPlan } from '../coaching/quality-gate';
import type { RiderProfile } from '../knowledge/rider-profile';
import type { TrainingPhase } from '../knowledge/periodization';

// ─── Common ───────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
  /** Only present in development */
  detail?: string;
}

// ─── POST /api/plan/generate ──────────────────────────────────────────────────

export interface GeneratePlanRequest {
  athleteId: string;
  /** ISO date of the Monday — e.g. "2026-07-20" */
  weekOf: string;
  /** Override auto-detected phase */
  phaseOverride?: TrainingPhase;
  /** Days available this specific week (overrides profile default) */
  availableDays?: string[];
  /**
   * Inline profile — required when KV is not configured.
   * The client (app) reads this from AsyncStorage and sends it here.
   */
  profile?: RiderProfile;
  /**
   * Intervals.icu API key — used to fetch fitness data and upload workouts.
   * Optional: if omitted, fallback defaults are used for training load.
   */
  icuApiKey?: string;
  /**
   * Intervals.icu OAuth Bearer token (preferred over apiKey when available).
   * Set by the OAuth login flow; takes precedence over icuApiKey.
   */
  icuToken?: string;
  /**
   * Intervals.icu athlete ID (e.g. "i12345").
   * Defaults to athleteId if omitted.
   */
  icuAthleteId?: string;
}

export interface GeneratePlanResponse {
  plan: WeeklyPlan;
  phase: TrainingPhase;
  wkg: number | null;
  retries: number;
  generatedAt: string; // ISO timestamp
}

// ─── GET /api/plan/:athleteId/:weekOf ─────────────────────────────────────────

export interface GetPlanResponse {
  plan: WeeklyPlan | null; // null if no plan exists for this week
  cachedAt?: string;       // ISO timestamp of when plan was generated/cached
}

// ─── PATCH /api/plan/:athleteId/:weekOf ───────────────────────────────────────

/** Coach can update specific days of an existing plan */
export interface UpdatePlanRequest {
  /** Partial update — only the days included here are updated */
  updates: Array<{
    day: string;
    dayType?: 'training' | 'recovery' | 'rest';
    workoutName?: string;
    blocks?: unknown[];
    estimatedTSS?: number;
  }>;
  /** Coach note explaining the change (stored in history) */
  coachNote?: string;
}

export interface UpdatePlanResponse {
  plan: WeeklyPlan;
  updatedAt: string;
}

// ─── POST /api/feedback ───────────────────────────────────────────────────────

export interface PostFeedbackRequest {
  athleteId: string;
  weekOf: string;
  day: string;
  /** Did the athlete complete this workout? */
  completed: boolean;
  /** Perceived exertion 1–10 */
  rpe?: number;
  /** Free text */
  notes?: string;
  /** Was it harder or easier than expected? */
  feel?: 'much_easier' | 'easier' | 'as_expected' | 'harder' | 'much_harder';
}

export interface PostFeedbackResponse {
  saved: boolean;
  /** If the AI recommends an adjustment to the rest of the week's plan */
  planAdjustment?: {
    description: string;
    updatedDays: string[];
  };
}

// ─── GET /api/admin/athletes ──────────────────────────────────────────────────

export interface AthleteOverview {
  athleteId: string;
  name: string;
  ctl: number;
  tsb: number;
  currentPhase: TrainingPhase;
  thisWeekPlan: WeeklyPlan | null;
  lastFeedbackAt: string | null;
  lastFeedbackNote: string | null;
}

export interface GetAthletesResponse {
  athletes: AthleteOverview[];
}

// ─── POST /api/auth/zwift ─────────────────────────────────────────────────────

export interface ZwiftAuthRequest {
  username: string;
  password: string;
}

export interface ZwiftAuthResponse {
  athleteId: string;
  name: string;
  /** Bearer token stored on device — never sent back to client in plain log */
  token: string;
  expiresAt: string;
}

// ─── POST /api/auth/icu ───────────────────────────────────────────────────────

export interface IcuAuthRequest {
  athleteId: string; // intervals.icu athlete ID (e.g. "i12345")
  apiKey: string;
}

export interface IcuAuthResponse {
  connected: boolean;
  athleteName: string;
}

// ─── POST /api/profile ────────────────────────────────────────────────────────

export type SaveProfileRequest = Omit<RiderProfile, 'athleteId'> & {
  athleteId: string;
};

export interface SaveProfileResponse {
  saved: boolean;
  profile: RiderProfile;
}

// ─── GET /api/profile/:athleteId ─────────────────────────────────────────────

export interface GetProfileResponse {
  profile: RiderProfile | null;
}
