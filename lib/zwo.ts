/**
 * Generates real Zwift .zwo workout files (the same XML format Zwift's own
 * in-game workout editor saves) from one of the AI weekly plan's workout
 * entries.
 *
 * Tag/attribute names below (Warmup, Cooldown, SteadyState, IntervalsT, plus
 * their Duration/Power/OnPower/OffPower/Repeat attributes) match the
 * documented .zwo schema - https://github.com/h4l/zwift-workout-file-reference
 */

/**
 * One structured workout block from the AI's machine-readable plan — a ramp
 * (warmup/cooldown), a flat effort (steadystate), or a repeated interval set.
 */
export interface WorkoutStructureBlock {
  type: "warmup" | "steadystate" | "intervals" | "cooldown";
  /** Total duration of this block in minutes. */
  durationMin: number;
  /** Target power as a fraction of FTP (e.g. 0.90 = 90% FTP). */
  powerFtp: number;
  /** For intervals only: recovery power as fraction of FTP (e.g. 0.50). */
  recoveryPowerFtp?: number;
  /** For intervals only: number of repetitions. */
  repeats?: number;
  /** For intervals only: ON duration per rep in seconds. */
  onSec?: number;
  /** For intervals only: OFF (recovery) duration per rep in seconds. */
  offSec?: number;
  /** Short human label shown in the workout card. */
  label: string;
}

export interface ZwoWorkoutInput {
  title: string;
  /** e.g. "Endurance", "Sweet Spot", "Intervals", "Threshold", "VO2", "Recovery", "Rest" */
  type: string;
  durationMin: number;
  /** e.g. "65-75%" - omitted/empty for rest days. */
  targetPowerPctFtp?: string;
  description?: string;
  /** Machine-readable block structure from the AI. */
  structure?: WorkoutStructureBlock[];
}

/**
 * One editable step of the workout. Mirrors the four .zwo step shapes —
 * a ramp (Warmup/Cooldown), a flat block (SteadyState), or a repeated on/off
 * set (IntervalsT). All power values are fractions of FTP (1.00 = 100% FTP),
 * all durations in seconds.
 */
export type ZwoBlock =
  | { kind: "Warmup"; durationSec: number; powerLow: number; powerHigh: number }
  | { kind: "Cooldown"; durationSec: number; powerLow: number; powerHigh: number }
  | { kind: "SteadyState"; durationSec: number; power: number }
  | {
      kind: "IntervalsT";
      repeat: number;
      onDuration: number;
      offDuration: number;
      onPower: number;
      offPower: number;
    };

/** 7-tier power breakdown (Coggan zones, with Sweet Spot split out). */
export const POWER_ZONES = [
  { zone: 1, maxPct: 0.55, color: "#9aa0a6", label: "Z1" },
  { zone: 2, maxPct: 0.75, color: "#3b82f6", label: "Z2" },
  { zone: 3, maxPct: 0.88, color: "#22d3ee", label: "Z3" },
  { zone: 4, maxPct: 0.94, color: "#10b981", label: "SweetSpot" },
  { zone: 5, maxPct: 1.05, color: "#f59e0b", label: "Threshold" },
  { zone: 6, maxPct: 1.2,  color: "#f97316", label: "VO2max" },
  { zone: 7, maxPct: Infinity, color: "#ef4444", label: "Sprint" },
] as const;

export function zoneForPowerFraction(frac: number) {
  return POWER_ZONES.find((z) => frac <= z.maxPct) ?? POWER_ZONES[POWER_ZONES.length - 1];
}

function powerAtTime(blocks: ZwoBlock[], t: number): number {
  let elapsed = 0;
  for (const b of blocks) {
    const dur = blockDurationSec(b);
    if (t < elapsed + dur || b === blocks[blocks.length - 1]) {
      const local = Math.max(0, t - elapsed);
      switch (b.kind) {
        case "Warmup":
        case "Cooldown": {
          const frac = dur > 0 ? Math.min(1, local / dur) : 0;
          return b.powerLow + (b.powerHigh - b.powerLow) * frac;
        }
        case "SteadyState":
          return b.power;
        case "IntervalsT": {
          const cycle = b.onDuration + b.offDuration || 1;
          const posInCycle = local % cycle;
          return posInCycle < b.onDuration ? b.onPower : b.offPower;
        }
      }
    }
    elapsed += dur;
  }
  return 0.6;
}

export function sampleWorkoutPower(blocks: ZwoBlock[], steps = 40): number[] {
  const total = blocks.reduce((s, b) => s + blockDurationSec(b), 0) || 1;
  const samples: number[] = [];
  const SUB = 8;
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * total;
    const t1 = ((i + 1) / steps) * total;
    let peak = 0;
    for (let j = 0; j < SUB; j++) {
      const t = t0 + ((j + 0.5) / SUB) * (t1 - t0);
      const p = powerAtTime(blocks, t);
      if (p > peak) peak = p;
    }
    samples.push(peak);
  }
  return samples;
}

export function effortForType(type: string): number {
  const t = type.toLowerCase();
  if (t.includes("rest")) return 0;
  if (t.includes("recover")) return 1;
  if (t.includes("endurance") || t.includes("foundation")) return 2;
  if (t.includes("tempo")) return 3;
  if (t.includes("sweet") || t.includes("strength") || t.includes("intermittent")) return 4;
  if (t.includes("threshold") || t.includes("vo2") || t.includes("interval")) return 5;
  return 3;
}

export function blockDurationSec(b: ZwoBlock): number {
  if (b.kind === "IntervalsT") return b.repeat * (b.onDuration + b.offDuration);
  return b.durationSec;
}

export function structureToBlocks(structure: WorkoutStructureBlock[]): ZwoBlock[] {
  const blocks: ZwoBlock[] = [];
  for (const b of structure) {
    const durationSec = Math.max(60, Math.round(b.durationMin * 60));
    switch (b.type) {
      case "warmup":
        blocks.push({ kind: "Warmup", durationSec, powerLow: 0.45, powerHigh: b.powerFtp });
        break;
      case "cooldown":
        blocks.push({ kind: "Cooldown", durationSec, powerLow: b.powerFtp, powerHigh: 0.40 });
        break;
      case "steadystate":
        blocks.push({ kind: "SteadyState", durationSec, power: b.powerFtp });
        break;
      case "intervals": {
        const onSec  = b.onSec  ?? Math.round(durationSec / ((b.repeats ?? 3) * 2));
        const offSec = b.offSec ?? onSec;
        const repeat = b.repeats ?? Math.max(2, Math.round(durationSec / (onSec + offSec)));
        blocks.push({
          kind: "IntervalsT",
          repeat,
          onDuration:  onSec,
          offDuration: offSec,
          onPower:  b.powerFtp,
          offPower: b.recoveryPowerFtp ?? 0.50,
        });
        break;
      }
    }
  }
  return blocks;
}

export function isRestDay(type: string): boolean {
  return type.toLowerCase().includes("rest");
}

export function isRunWorkout(type: string): boolean {
  return type.toLowerCase().includes("run");
}

export function generateDefaultBlocks(w: ZwoWorkoutInput): ZwoBlock[] {
  if (w.structure && w.structure.length > 0) {
    return structureToBlocks(w.structure);
  }

  const totalSec = Math.max(300, Math.round(w.durationMin * 60));
  const t = w.type.toLowerCase();
  const { low, high, mid } = parsePowerRange(w.targetPowerPctFtp);

  if (t.includes("recover")) {
    const warm = Math.round(totalSec * 0.2);
    const main = totalSec - warm * 2;
    return [
      { kind: "Warmup",      durationSec: warm, powerLow: 0.4,  powerHigh: mid },
      { kind: "SteadyState", durationSec: main, power: mid },
      { kind: "Cooldown",    durationSec: warm, powerLow: mid,  powerHigh: 0.4 },
    ];
  }

  if (t.includes("strength") || t.includes("sprint") || t.includes("neuromuscular")) {
    const warm = Math.round(totalSec * 0.25);
    const cool = Math.round(totalSec * 0.25);
    const mainSec = Math.max(60, totalSec - warm - cool);
    const onDuration = 15;
    const offDuration = 105;
    const repeat = Math.max(3, Math.round(mainSec / (onDuration + offDuration)));
    const onPower = Math.max(high || mid || 1.5, 1.5);
    return [
      { kind: "Warmup",     durationSec: warm, powerLow: 0.45, powerHigh: 0.65 },
      { kind: "IntervalsT", repeat, onDuration, offDuration, onPower, offPower: 0.5 },
      { kind: "Cooldown",   durationSec: cool, powerLow: 0.55, powerHigh: 0.4 },
    ];
  }

  if (t.includes("intermittent") || t.includes("micro")) {
    const warm = Math.round(totalSec * 0.15);
    const cool = Math.round(totalSec * 0.15);
    const mainSec = Math.max(60, totalSec - warm - cool);
    const onDuration = 30;
    const offDuration = 30;
    const repeat = Math.max(4, Math.round(mainSec / (onDuration + offDuration)));
    const onPower = high || mid || 1.1;
    const offPower = Math.max(0.4, (low || mid || 0.5) - 0.1);
    return [
      { kind: "Warmup",     durationSec: warm, powerLow: 0.45, powerHigh: 0.7 },
      { kind: "IntervalsT", repeat, onDuration, offDuration, onPower, offPower },
      { kind: "Cooldown",   durationSec: cool, powerLow: 0.6,  powerHigh: 0.4 },
    ];
  }

  if (t.includes("interval") || t.includes("sweet") || t.includes("threshold") || t.includes("vo2")) {
    const warm = Math.round(totalSec * 0.15);
    const cool = Math.round(totalSec * 0.15);
    const mainSec = Math.max(60, totalSec - warm - cool);
    const onDuration = t.includes("vo2") ? 180 : t.includes("threshold") ? 480 : 300;
    const offDuration = Math.round(onDuration * 0.5);
    const repeat = Math.max(2, Math.round(mainSec / (onDuration + offDuration)));
    const onPower = high || mid || 0.9;
    const offPower = Math.max(0.45, (low || mid || 0.6) - 0.15);
    return [
      { kind: "Warmup",     durationSec: warm, powerLow: 0.45, powerHigh: 0.7 },
      { kind: "IntervalsT", repeat, onDuration, offDuration, onPower, offPower },
      { kind: "Cooldown",   durationSec: cool, powerLow: 0.65, powerHigh: 0.4 },
    ];
  }

  const warm = Math.round(totalSec * 0.1);
  const cool = Math.round(totalSec * 0.1);
  const main = totalSec - warm - cool;
  return [
    { kind: "Warmup",      durationSec: warm, powerLow: 0.45, powerHigh: mid },
    { kind: "SteadyState", durationSec: main, power: mid },
    { kind: "Cooldown",    durationSec: cool, powerLow: mid,  powerHigh: 0.45 },
  ];
}

function parsePowerRange(pct?: string): { low: number; high: number; mid: number } {
  const nums = pct?.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return { low: 0.6, high: 0.6, mid: 0.6 };
  if (nums.length === 1) {
    const v = nums[0] / 100;
    return { low: v, high: v, mid: v };
  }
  const low = nums[0] / 100;
  const high = nums[1] / 100;
  return { low, high, mid: (low + high) / 2 };
}

function suggestedOnCadence(onPowerFtp: number): number {
  if (onPowerFtp >= 1.05) return 95;
  if (onPowerFtp >= 0.88) return 90;
  return 85;
}

export function computeIfTss(blocks: ZwoBlock[]): { intensityFactor: number; tss: number; totalSec: number } {
  let weightedSum = 0;
  let totalSec = 0;
  const add = (durSec: number, powerFrac: number) => {
    weightedSum += durSec * Math.pow(powerFrac, 4);
    totalSec += durSec;
  };
  for (const b of blocks) {
    if (b.kind === "IntervalsT") {
      for (let r = 0; r < b.repeat; r++) {
        add(b.onDuration, b.onPower);
        add(b.offDuration, b.offPower);
      }
    } else if (b.kind === "SteadyState") {
      add(b.durationSec, b.power);
    } else {
      add(b.durationSec, (b.powerLow + b.powerHigh) / 2);
    }
  }
  if (totalSec === 0) return { intensityFactor: 0, tss: 0, totalSec: 0 };
  const intensityFactor = Math.pow(weightedSum / totalSec, 0.25);
  const tss = (totalSec * intensityFactor * intensityFactor * 100) / 3600;
  return {
    intensityFactor: Math.round(intensityFactor * 1000) / 1000,
    tss: Math.round(tss * 10) / 10,
    totalSec,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function powerToPaceZone(frac: number): 0 | 1 | 2 | 3 {
  if (frac <= 0.60) return 0;
  if (frac <= 0.75) return 1;
  if (frac <= 0.88) return 2;
  return 3;
}

const RUN_PRESCRIPTION: Record<0 | 1 | 2 | 3, string> = {
  0: "WALK",
  1: "JOG",
  2: "RUN",
  3: "GO!",
};

function blockToRunXml(b: ZwoBlock): string {
  switch (b.kind) {
    case "Warmup":
    case "Cooldown": {
      const pace = powerToPaceZone(b.powerLow);
      return `<${b.kind} Duration="${Math.round(b.durationSec)}" pace="${pace}" replacement_prescription="${RUN_PRESCRIPTION[pace]}"/>`;
    }
    case "SteadyState": {
      const pace = powerToPaceZone(b.power);
      return `<SteadyState Duration="${Math.round(b.durationSec)}" pace="${pace}" replacement_prescription="${RUN_PRESCRIPTION[pace]}"/>`;
    }
    case "IntervalsT": {
      const onPace = powerToPaceZone(b.onPower);
      const offPace = powerToPaceZone(b.offPower);
      return `<IntervalsT Repeat="${Math.round(b.repeat)}" OnDuration="${Math.round(b.onDuration)}" OffDuration="${Math.round(b.offDuration)}" OnPace="${onPace}" OffPace="${offPace}"/>`;
    }
  }
}

function blockToXml(b: ZwoBlock, isRun = false): string {
  if (isRun) return blockToRunXml(b);
  const fmt = (n: number) => n.toFixed(2);
  switch (b.kind) {
    case "Warmup":
    case "Cooldown":
      return `<${b.kind} Duration="${Math.round(b.durationSec)}" PowerLow="${fmt(b.powerLow)}" PowerHigh="${fmt(b.powerHigh)}"/>`;
    case "SteadyState":
      return `<SteadyState Duration="${Math.round(b.durationSec)}" Power="${fmt(b.power)}"/>`;
    case "IntervalsT": {
      const cadence = suggestedOnCadence(b.onPower);
      return `<IntervalsT Repeat="${Math.round(b.repeat)}" OnDuration="${Math.round(b.onDuration)}" OffDuration="${Math.round(b.offDuration)}" OnPower="${fmt(b.onPower)}" OffPower="${fmt(b.offPower)}" Cadence="${cadence}" CadenceResting="85"/>`;
    }
  }
}

export function generateZwoXml(
  w: ZwoWorkoutInput,
  blocks?: ZwoBlock[],
  authorName = "Zwift AI Coach"
): string {
  const isRun = isRunWorkout(w.type);
  const steps = (blocks ?? generateDefaultBlocks(w)).map((b) => blockToXml(b, isRun));
  const sportType = isRun ? "run" : "bike";
  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>${escapeXml(authorName)}</author>
    <name>${escapeXml(w.title)}</name>
    <description>${escapeXml(w.description ?? "")}</description>
    <sportType>${sportType}</sportType>
    <tags>
        <tag name="${escapeXml(w.type)}"/>
    </tags>
    <workout>
        ${steps.join("\n        ")}
    </workout>
</workout_file>
`;
}

export function zwoFileName(date: string | undefined, title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${date ?? "plan"}-${slug || "workout"}.zwo`;
}
