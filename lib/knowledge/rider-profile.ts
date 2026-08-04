/**
 * Rider training profile — the "who are you and what do you want?" layer.
 * Stored in AsyncStorage + backend.
 */

export type TrainingGoal = "fitness" | "ftp" | "weight" | "event" | "fun";
export type SessionLength = "45" | "60" | "90" | "90plus";
export type Sport = "cycling" | "running" | "both";
export type DaysRange = "1-2" | "2-3" | "3-4" | "4-5" | "5-6" | "6-7";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

/** Where the rider actually trains: "indoor" = Zwift/trainer only,
 *  "outdoor" = real-world rides only, "both" = a mix. */
export type TrainingEnvironment = "indoor" | "outdoor" | "both";

export interface RiderProfile {
  /** Athlete ID (from Zwift or app-internal) */
  athleteId: string;
  name: string;
  email?: string;

  /** FTP in watts (cycling) — manually set, never silently overridden */
  ftp?: number;
  /** Threshold Pace in min/km (running) */
  thresholdPace?: number;
  /** Body weight in kg */
  weightKg?: number;

  goals: TrainingGoal[];
  experienceLevel: ExperienceLevel;
  daysRange: DaysRange;
  sessionLength: SessionLength;
  sports: Sport[];
  environment?: TrainingEnvironment;

  ageYears?: number;
  /** ISO date string — for event-goal riders */
  eventDate?: string;
  notes?: string;
}

export const SPORT_LABELS: Record<Sport, string> = {
  cycling: "Cycling",
  running: "Running",
  both:    "Cycling & Running",
};

export const ENVIRONMENT_LABELS: Record<TrainingEnvironment, string> = {
  indoor:  "Indoor (Zwift)",
  outdoor: "Outdoor only",
  both:    "Indoor & Outdoor",
};

export const GOAL_LABELS: Record<TrainingGoal, string> = {
  fitness: "Improve overall fitness",
  ftp:     "Increase FTP",
  weight:  "Lose weight / body composition",
  event:   "Train for an event",
  fun:     "Ride for fun",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner:     "Beginner",
  intermediate: "Intermediate",
  advanced:     "Advanced",
};

export const DAYS_RANGE_LABELS: Record<DaysRange, string> = {
  "1-2": "1–2 days / week",
  "2-3": "2–3 days / week",
  "3-4": "3–4 days / week",
  "4-5": "4–5 days / week",
  "5-6": "5–6 days / week",
  "6-7": "6–7 days / week",
};

/** Midpoint of each range — used to cap session count in the AI prompt. */
export const DAYS_RANGE_MID: Record<DaysRange, number> = {
  "1-2": 1.5,
  "2-3": 2.5,
  "3-4": 3.5,
  "4-5": 4.5,
  "5-6": 5.5,
  "6-7": 6.5,
};

export const SESSION_LENGTH_LABELS: Record<SessionLength, string> = {
  "45":     "Up to 45 min",
  "60":     "45–60 min",
  "90":     "60–90 min",
  "90plus": "90+ min",
};

export const SESSION_LENGTH_MINUTES: Record<SessionLength, number> = {
  "45":     40,
  "60":     55,
  "90":     75,
  "90plus": 100,
};

/** Compute W/kg from FTP and weight. Returns null if either is missing. */
export function computeWkg(ftp?: number, weightKg?: number): number | null {
  if (!ftp || !weightKg || weightKg <= 0) return null;
  return Math.round((ftp / weightKg) * 100) / 100;
}
