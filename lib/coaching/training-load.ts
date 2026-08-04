/**
 * Deterministic training-load model — the foundation of the "rider readiness"
 * layer feeding plan generation.
 *
 * Computes the standard Coggan/TrainingPeaks ATL/CTL/TSB model:
 *  - ATL (Acute Training Load): 7-day exponentially weighted average ("fatigue")
 *  - CTL (Chronic Training Load): 42-day exponentially weighted average ("fitness")
 *  - TSB (Training Stress Balance) = CTL - ATL ("freshness")
 *
 * This is intentionally a simplification: each activity's "intensity factor"
 * is avgWatts / FTP (or HR-based for non-power activities). Real TSS uses
 * Normalized Power, which runs higher than plain average power on variable
 * rides — so this proxy slightly underestimates true stress on interval
 * rides. That's fine for a relative week-to-week trend signal.
 */

export interface ActivitySummary {
  date?: string;        // ISO date string "YYYY-MM-DD"
  durationMin: number;
  avgWatts?: number;
  avgHeartRate?: number;
  normalizedPower?: number;
  /** TSS directly from ICU (most accurate — use when available) */
  icuTrainingLoad?: number;
}

export interface TrainingLoadSummary {
  /** Chronic Training Load (~42-day avg). Higher = more aerobic base. */
  ctl: number;
  /** Acute Training Load (~7-day avg). Higher = more recent fatigue. */
  atl: number;
  /** TSB = CTL - ATL. Positive = fresh, negative = fatigued. */
  tsb: number;
  freshness: "fresh" | "neutral" | "fatigued";
  ridesLast7Days: number;
  ridesPrior7Days: number;
}

const ATL_DAYS = 7;
const CTL_DAYS = 42;

function dayKey(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function tssProxy(activity: ActivitySummary, referenceWatts: number): number {
  // Use ICU training load directly when available (most accurate)
  if (activity.icuTrainingLoad && activity.icuTrainingLoad > 0) {
    return activity.icuTrainingLoad;
  }

  const effortWatts = activity.normalizedPower ?? activity.avgWatts;

  // Power-based TSS (cycling with power meter)
  if (effortWatts && effortWatts > 0 && referenceWatts > 0 && activity.durationMin > 0) {
    const intensityFactor = effortWatts / referenceWatts;
    const durationHours = activity.durationMin / 60;
    return durationHours * intensityFactor * intensityFactor * 100;
  }

  // HR-based TSS fallback (runs, walks, no power data)
  if (activity.avgHeartRate && activity.avgHeartRate > 0 && activity.durationMin > 0) {
    const estimatedMaxHR = 180; // conservative adult midpoint
    const hrIF = Math.min(1.0, activity.avgHeartRate / estimatedMaxHR);
    const durationHours = activity.durationMin / 60;
    return durationHours * hrIF * hrIF * 100;
  }

  return 0;
}

/**
 * Computes current training load from recent activity history.
 * `asOf` defaults to now.
 */
export function computeTrainingLoad(
  activities: ActivitySummary[],
  ftp?: number,
  asOf: Date = new Date()
): TrainingLoadSummary {
  const dated = activities.filter((a) => dayKey(a.date) !== null);

  if (dated.length === 0) {
    return { ctl: 0, atl: 0, tsb: 0, freshness: "neutral", ridesLast7Days: 0, ridesPrior7Days: 0 };
  }

  const referenceWatts = ftp && ftp > 0
    ? ftp
    : Math.max(1, ...dated.map((a) => a.avgWatts || 0));

  const dailyStressByDate: Record<string, number> = {};
  for (const a of dated) {
    const key = dayKey(a.date)!;
    dailyStressByDate[key] = (dailyStressByDate[key] ?? 0) + tssProxy(a, referenceWatts);
  }

  const earliestKey = dated.reduce<string>((min, a) => {
    const k = dayKey(a.date)!;
    return k < min ? k : min;
  }, dayKey(dated[0].date)!);

  const lookbackStart = new Date(asOf.getTime() - CTL_DAYS * 86400000);
  const earliestDate = new Date(earliestKey);
  const startDate = earliestDate.getTime() < lookbackStart.getTime() ? lookbackStart : earliestDate;

  let atl = 0;
  let ctl = 0;
  const atlDecay = Math.exp(-1 / ATL_DAYS);
  const ctlDecay = Math.exp(-1 / CTL_DAYS);
  for (const d = new Date(startDate); d.getTime() <= asOf.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const stress = dailyStressByDate[key] ?? 0;
    atl = atl * atlDecay + stress * (1 - atlDecay);
    ctl = ctl * ctlDecay + stress * (1 - ctlDecay);
  }

  const daysAgo = (key: string) => (asOf.getTime() - new Date(key).getTime()) / 86400000;
  const ridesLast7Days = dated.filter((a) => {
    const d = daysAgo(dayKey(a.date)!);
    return d >= 0 && d < 7;
  }).length;
  const ridesPrior7Days = dated.filter((a) => {
    const d = daysAgo(dayKey(a.date)!);
    return d >= 7 && d < 14;
  }).length;

  const tsb = ctl - atl;
  const freshness: TrainingLoadSummary["freshness"] =
    tsb > 5 ? "fresh" : tsb < -5 ? "fatigued" : "neutral";

  return {
    ctl: round1(ctl),
    atl: round1(atl),
    tsb: round1(tsb),
    freshness,
    ridesLast7Days,
    ridesPrior7Days,
  };
}
