/**
 * Power zones and pace zones — single source of truth.
 * All coaching logic reads from here. Never hardcode percentages elsewhere.
 */

export const CYCLING_ZONES = [
  { zone: 1, name: 'Active Recovery', ftpMin: 0,   ftpMax: 0.55, description: 'Very easy, recovery only' },
  { zone: 2, name: 'Endurance',       ftpMin: 0.56, ftpMax: 0.75, description: 'Aerobic base building' },
  { zone: 3, name: 'Tempo',           ftpMin: 0.76, ftpMax: 0.90, description: 'Sustained effort, lactate clearance' },
  { zone: 4, name: 'Threshold',       ftpMin: 0.91, ftpMax: 1.05, description: 'FTP work, raises lactate threshold' },
  { zone: 5, name: 'VO2max',          ftpMin: 1.06, ftpMax: 1.20, description: 'Maximal aerobic power' },
  { zone: 6, name: 'Anaerobic',       ftpMin: 1.21, ftpMax: 1.50, description: 'Short, very hard efforts' },
  { zone: 7, name: 'Neuromuscular',   ftpMin: 1.50, ftpMax: 9.99, description: 'Sprint, max effort' },
] as const;

export type CyclingZone = typeof CYCLING_ZONES[number];

/** Sweet Spot = upper Z3 / lower Z4 — most efficient training zone */
export const SWEET_SPOT = { ftpMin: 0.88, ftpMax: 0.94 };

/**
 * Running pace zones (% of threshold pace, i.e. 1.0 = threshold).
 * Pace zones are inverse: lower % = faster pace.
 */
export const RUNNING_ZONES = [
  { zone: 1, name: 'Easy',           paceMin: 1.20, paceMax: 9.99, description: 'Conversational, recovery' },
  { zone: 2, name: 'Aerobic',        paceMin: 1.10, paceMax: 1.20, description: 'Comfortable aerobic effort' },
  { zone: 3, name: 'Tempo',          paceMin: 1.00, paceMax: 1.10, description: 'Comfortably hard, marathon pace' },
  { zone: 4, name: 'Threshold',      paceMin: 0.95, paceMax: 1.00, description: 'Lactate threshold, 1h race pace' },
  { zone: 5, name: 'VO2max',         paceMin: 0.85, paceMax: 0.95, description: '5–15 min race pace' },
  { zone: 6, name: 'Neuromuscular',  paceMin: 0.00, paceMax: 0.85, description: 'Sprint efforts' },
] as const;
