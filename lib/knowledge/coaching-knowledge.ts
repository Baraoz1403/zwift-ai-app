/**
 * Cycling coaching knowledge base — curated workout library and periodization
 * principles for generating professional training plans.
 *
 * Ported from the Zwift AI Dashboard (lib/coaching-knowledge.ts).
 * Adapted for the zwift-ai-app (React Native / Expo).
 *
 * This file serves two purposes:
 *  1. Reference: human-readable documentation of every named workout protocol.
 *  2. Source: the condensed WORKOUT_LIBRARY_PROMPT constant is injected into
 *     the AI system prompt to make plans feel like real coaching.
 *
 * Sources:
 *  - Zwift's official plans (FTP Builder, Build Me Up, Zwift Academy)
 *  - Coggan / Allen power-based training zones
 *  - Norwegian VO2max model (Seiler & Tønnessen)
 *  - TrainerRoad / Sufferfest canonical interval formats
 *  - FasCat Coaching sweet spot principles (Frank Overton)
 */

import type { WorkoutStructureBlock } from "../zwo";

// ─── Coggan 7-Zone Power Model ─────────────────────────────────────────────
export const POWER_ZONES = {
  Z1: { name: "Active Recovery",     pctFtp: "< 55%",    feel: "effortless, conversational" },
  Z2: { name: "Endurance",           pctFtp: "56-75%",   feel: "easy, full sentences" },
  Z3: { name: "Tempo",               pctFtp: "76-90%",   feel: "moderately hard, 3-4 words" },
  Z4: { name: "Lactate Threshold",   pctFtp: "91-105%",  feel: "hard, single words" },
  Z5: { name: "VO2max",              pctFtp: "106-120%", feel: "very hard, 1-2 min sustainable" },
  Z6: { name: "Anaerobic Capacity",  pctFtp: "121-150%", feel: "maximal, 30-90 s sustainable" },
  Z7: { name: "Neuromuscular Power", pctFtp: "> 150%",   feel: "all-out sprint, < 30 s" },
} as const;

// ─── W/kg Rider Classification ──────────────────────────────────────────────
/**
 * Power-to-weight is ONE input into session selection, not the sole gate.
 * W/kg mainly measures climbing performance; session-readiness also depends
 * on age, training history, injury/medical history, technical skill, goals,
 * recovery capacity, and how the rider has actually responded to intensity.
 * This table is a coarse, useful starting point — the AI should override it
 * when the rider's own profile/notes/history say otherwise.
 */
export const RIDER_LEVEL_THRESHOLDS = [
  { label: "Beginner",     minWkg: 0.0,  maxWkg: 2.5,  note: "Foundation + Tempo + Sprint Builder only. No true threshold or VO2max." },
  { label: "Novice",       minWkg: 2.5,  maxWkg: 3.0,  note: "Add Sweet Spot Classic. Threshold Development only in late Build phase." },
  { label: "Intermediate", minWkg: 3.0,  maxWkg: 3.5,  note: "Full sweet spot range. Add Threshold Development, Micro Intervals, 4×4 Two-Set." },
  { label: "Trained",      minWkg: 3.5,  maxWkg: 4.0,  note: "Norwegian 4×4, Over-Under Intervals, 2×20 FTP Blocks, Descending Threshold unlocked." },
  { label: "Advanced",     minWkg: 4.0,  maxWkg: 4.5,  note: "Full library. Polarized model (more Z2 + more Z5, less Z3/Z4 middle ground)." },
  { label: "Elite",        minWkg: 4.5,  maxWkg: 99.0, note: "All sessions available. High volume demands longer recovery windows between hard days." },
] as const;

// ─── Session Readiness Prerequisites (minimum TSB) ─────────────────────────
/**
 * Minimum TSB suggested for each session category.
 * TSB is a mathematical training-load MODEL, not a direct measurement of the
 * rider's body. These thresholds are soft, population-level heuristics.
 * The AI must treat the rider's own stated notes, subjective feel, and any
 * illness/injury signal as equal or higher priority than the TSB number.
 */
export const SESSION_PREREQUISITES = {
  vo2max:        { minTsb: -5,  fallback: "Sweet Spot Classic",   note: "VO2max demands near-maximal cardiac output — legs must be fresh." },
  threshold:     { minTsb: -12, fallback: "Sweet Spot Classic",   note: "Sustained threshold with tired legs becomes junk miles, not adaptation." },
  sweetspot:     { minTsb: -20, fallback: "Tempo Cruise",         note: "Sweet spot is resilient to moderate fatigue." },
  neuromuscular: { minTsb: -15, fallback: "Sprint Builder",       note: "Maximal neural efforts need reasonably fresh legs." },
  intermittent:  { minTsb: -8,  fallback: "Tempo Cruise",         note: "30/30 and similar work is metabolically demanding." },
  tempo:         { minTsb: -99, fallback: "Foundation Ride",      note: "Tempo always productive regardless of fatigue level." },
  endurance:     { minTsb: -99, fallback: "Easy Flush",           note: "Always OK — aerobic stimulus without meaningful stress." },
  recovery:      { minTsb: -99, fallback: "Spin & Recover",       note: "The purpose is to flush fatigue, not create it." },
} as const;

// ─── Named Workout Library ──────────────────────────────────────────────────

export type WorkoutCategory =
  | "recovery" | "endurance" | "tempo" | "sweetspot"
  | "threshold" | "vo2max" | "neuromuscular" | "intermittent";

export interface NamedWorkout {
  name: string;
  category: WorkoutCategory;
  durationMin: number;
  tss: number;
  rationale: string;
  structure: string;
  executionCue: string;
  successFeel: string;
  tags: string[];
}

export const WORKOUT_LIBRARY: NamedWorkout[] = [

  // ── RECOVERY ─────────────────────────────────────────────────────────────
  {
    name: "Spin & Recover",
    category: "recovery",
    durationMin: 30,
    tss: 20,
    rationale: "Active recovery — flushes metabolic waste products from the previous session without adding new training stress. Blood flow without biochemical cost.",
    structure: "30 min continuous @ 50-60% FTP, 90+ rpm, no structure",
    executionCue: "Keep power at 50-60% FTP and cadence above 90 rpm. If legs feel heavy at the start, that's exactly the point of this ride — the heaviness should ease in the last 10 minutes.",
    successFeel: "You should feel noticeably better at minute 25 than minute 5. If you feel worse or the same, you were going too hard.",
    tags: ["recovery", "beginner-friendly"],
  },
  {
    name: "Easy Flush",
    category: "recovery",
    durationMin: 45,
    tss: 30,
    rationale: "Sustained low-intensity blood flow promotes lactate clearance after hard efforts — often more valuable than complete rest because active circulation accelerates recovery.",
    structure: "10 min easy build → 25 min Z1 @ 55% FTP → 10 min cooldown",
    executionCue: "The 25-minute Z1 block is non-negotiable. Resist the urge to push harder — this ride's job is biochemical, not cardiovascular.",
    successFeel: "Finish feeling energized, not depleted. If you're tired at the end, you were going too hard.",
    tags: ["recovery"],
  },

  // ── ENDURANCE / FOUNDATION ────────────────────────────────────────────────
  {
    name: "Foundation Ride",
    category: "endurance",
    durationMin: 60,
    tss: 60,
    rationale: "Builds mitochondrial density and fat-oxidation enzymes — the aerobic base that every higher-intensity session rests on.",
    structure: "10 min warmup → 40 min Z2 @ 65-73% FTP (conversational pace) → 10 min cooldown",
    executionCue: "Hold 65-73% FTP the entire 40 minutes. Cadence 88-95 rpm. If you can't complete full sentences, you're above Z2.",
    successFeel: "You should finish feeling like you could easily ride 30 more minutes. That's not failure — that's the correct Z2 intensity signal.",
    tags: ["aerobic-base", "beginner-friendly", "zwift-ftp-builder"],
  },
  {
    name: "Long Endurance",
    category: "endurance",
    durationMin: 90,
    tss: 90,
    rationale: "Extended aerobic volume promotes fat-oxidation and glycogen-sparing adaptations.",
    structure: "15 min warmup → 65 min Z2 @ 65-73% FTP → 10 min cooldown",
    executionCue: "The first 30 minutes feel easy — resist the temptation to increase intensity.",
    successFeel: "Slightly tired but not depleted at 90 minutes.",
    tags: ["aerobic-base", "volume"],
  },
  {
    name: "Two-Hour Foundation",
    category: "endurance",
    durationMin: 120,
    tss: 120,
    rationale: "Extended Z2 duration is associated with enhanced mitochondrial adaptation and fat-oxidation enzyme upregulation. The cornerstone of long-term aerobic development.",
    structure: "20 min easy warmup → 85 min Z2 @ 65-73% FTP → 15 min cooldown",
    executionCue: "Power must stay in Z2 for the full 85 minutes. The first 40 minutes should feel suspiciously easy — that's correct.",
    successFeel: "Pleasantly tired, not depleted. If you're wiped out, you were riding at Z3.",
    tags: ["aerobic-base", "long", "seiler", "fat-oxidation"],
  },
  {
    name: "Z2 with Cadence Drills",
    category: "endurance",
    durationMin: 60,
    tss: 58,
    rationale: "Foundation ride with short high-cadence inserts (100-110 rpm) to improve neuromuscular efficiency.",
    structure: "10 min warmup → 4× (8 min Z2 @ 68% + 2 min @ 100-110 rpm / 65%) → 10 min cooldown",
    executionCue: "During the 2-min high-cadence inserts, let your legs spin freely — don't mash.",
    successFeel: "The 100-rpm blocks should feel almost bouncy, not choppy.",
    tags: ["aerobic-base", "technique"],
  },
  {
    name: "Surge Ride",
    category: "endurance",
    durationMin: 60,
    tss: 72,
    rationale: "Long Z2 ride with embedded 1-minute power surges at 110% FTP — adds metabolic variety without the recovery cost of a full interval workout.",
    structure: "12 min warmup → 36 min Z2 @ 68% FTP with 6×1 min surges @ 110% FTP (5 min apart) → 12 min cooldown",
    executionCue: "The surges should be sharp and decisive — full power for 1 minute, then immediately drop back to Z2 pace.",
    successFeel: "The Z2 sections between surges should still feel controlled.",
    tags: ["aerobic-base", "mixed-intensity", "base-phase-ok"],
  },
  {
    name: "Endurance with Muscle Tension",
    category: "endurance",
    durationMin: 65,
    tss: 70,
    rationale: "Z2 ride with embedded low-cadence blocks (55-60 rpm) that build cycling-specific leg strength.",
    structure: "12 min warmup → 4× (6 min Z2 @ 68% / 90 rpm → 5 min Z2 @ 68% / 55 rpm) → 9 min cooldown",
    executionCue: "During the 55-rpm blocks, resist the urge to raise power — the goal is muscular stress, not cardiovascular stress.",
    successFeel: "Quads have a muscular burn similar to a gym session, but heart rate never exceeded 75% of max.",
    tags: ["aerobic-base", "muscular-endurance", "low-cadence"],
  },

  // ── TEMPO ─────────────────────────────────────────────────────────────────
  {
    name: "Tempo Cruise",
    category: "tempo",
    durationMin: 60,
    tss: 72,
    rationale: "Trains lactate clearance and glycogen storage at Z3; steady-state tempo builds the metabolic ceiling that sweet spot and threshold work sits on top of.",
    structure: "10 min warmup → 2×15 min @ 78-83% FTP (5 min recovery) → 15 min cooldown",
    executionCue: "Hold 78-83% FTP — comfortably uncomfortable. You should be able to say 3-4 words if asked but not hold a full sentence.",
    successFeel: "The second 15-minute block should feel harder than the first, but completeable.",
    tags: ["tempo", "z3", "zwift-ftp-builder"],
  },
  {
    name: "Tempo Ladder",
    category: "tempo",
    durationMin: 75,
    tss: 90,
    rationale: "Progressively longer blocks teach the body to sustain Z3 for extended periods.",
    structure: "12 min warmup → 10 min + 15 min + 20 min @ 80% FTP (5 min recovery each) → 13 min cooldown",
    executionCue: "Start the 10-minute block conservatively at 78% FTP. Build to 81% for the 15-min block.",
    successFeel: "The 20-minute block should be genuinely hard by minutes 16-20.",
    tags: ["tempo", "progression"],
  },
  {
    name: "Strength Endurance",
    category: "tempo",
    durationMin: 65,
    tss: 80,
    rationale: "Low-cadence (55-65 rpm) Z3 efforts build leg muscular strength — the cycling equivalent of gym leg press, done on the bike.",
    structure: "15 min warmup → 3×8 min @ 78-84% FTP / 55-65 rpm (4 min recovery @ 60% / 90 rpm) → 14 min cooldown",
    executionCue: "Cadence is the key variable here. Keep it deliberately at 55-65 rpm during work intervals.",
    successFeel: "Quads should feel muscularly tired (like after a leg workout) rather than cardiovascularly depleted.",
    tags: ["tempo", "strength", "muscular-endurance"],
  },
  {
    name: "Sub-Threshold Blocks",
    category: "tempo",
    durationMin: 75,
    tss: 88,
    rationale: "3×15 min at 87-89% FTP — the bridge between sweet spot and threshold.",
    structure: "12 min warmup → 3×15 min @ 88% FTP (5 min recovery) → 13 min cooldown",
    executionCue: "88% FTP is right at the boundary — you'll be working hard but the 15-minute blocks should be completeable.",
    successFeel: "Third block feels hard but not desperate. Ready to introduce Threshold Development next week.",
    tags: ["tempo", "sub-threshold", "progression"],
  },

  // ── SWEET SPOT ────────────────────────────────────────────────────────────
  {
    name: "Sweet Spot Primer",
    category: "sweetspot",
    durationMin: 55,
    tss: 68,
    rationale: "Entry-level sweet spot — four 7-minute blocks makes this more accessible for riders new to the zone.",
    structure: "12 min warmup → 4×7 min @ 88% FTP (3 min recovery) → 11 min cooldown",
    executionCue: "Start at 87% FTP even if it feels easy. Block 4 should feel noticeably harder than block 1.",
    successFeel: "All 4 blocks completed. Block 4 is the hardest.",
    tags: ["sweetspot", "beginner-friendly", "entry-level"],
  },
  {
    name: "Sweet Spot Classic",
    category: "sweetspot",
    durationMin: 60,
    tss: 78,
    rationale: "The most time-efficient training zone (88-93% FTP): hard enough to drive FTP adaptation, easy enough to recover from in 24-48 hours.",
    structure: "12 min warmup → 3×10 min @ 88-93% FTP (4 min recovery) → 14 min cooldown",
    executionCue: "Start each 10-min block at 88% — not 93%. You have 3 of them; pacing discipline on block 1 is what makes block 3 possible.",
    successFeel: "All 3 blocks completed with even power. Block 3 is hard, but you finish it.",
    tags: ["sweetspot", "ftp-builder", "zwift-build-me-up"],
  },
  {
    name: "3×15 Sweet Spot",
    category: "sweetspot",
    durationMin: 75,
    tss: 88,
    rationale: "The natural progression from 3×10 min — same number of reps, 50% more work per interval.",
    structure: "12 min warmup → 3×15 min @ 90% FTP (5 min recovery) → 13 min cooldown",
    executionCue: "3×15 is substantially harder than 3×10 — the last 5 minutes of each block is where the real adaptation happens.",
    successFeel: "All three 15-minute blocks completed near target power.",
    tags: ["sweetspot", "intermediate", "progression"],
  },
  {
    name: "Extended Sweet Spot",
    category: "sweetspot",
    durationMin: 75,
    tss: 100,
    rationale: "Two long sweet-spot blocks; extended time at 88-92% FTP creates a substantial aerobic adaptation signal.",
    structure: "15 min warmup → 2×20 min @ 88-92% FTP (8 min recovery) → 12 min cooldown",
    executionCue: "Use minutes 1-4 of the 8-minute recovery to genuinely recover below 65% FTP.",
    successFeel: "If you faded more than 3% in block 2, spend another week at Sweet Spot Classic before progressing here.",
    tags: ["sweetspot", "ftp-builder", "advanced"],
  },
  {
    name: "Sweet Spot Progression",
    category: "sweetspot",
    durationMin: 70,
    tss: 90,
    rationale: "Ascending blocks (10→15→20 min) apply progressive overload within a single session.",
    structure: "12 min warmup → 10 min + 15 min + 20 min @ 90% FTP (5 min recovery each) → 8 min cooldown",
    executionCue: "Treat the 10-min block as a warm-into-it at 88%. Step to 90% for the 15-min, then push to 92% if available for the 20-min block.",
    successFeel: "The 20-min block should feel substantially harder than the 10-min opener.",
    tags: ["sweetspot", "progression"],
  },
  {
    name: "Sweet Spot Time Trial",
    category: "sweetspot",
    durationMin: 65,
    tss: 84,
    rationale: "One continuous 35-minute block at sweet spot — builds the ability to sustain effort without recovery intervals.",
    structure: "12 min warmup → 35 min continuous @ 89% FTP → 18 min cooldown",
    executionCue: "No recovery — this is one unbroken effort. Start at 87% FTP; build to 89% by minute 10.",
    successFeel: "Completed all 35 minutes above 86% FTP.",
    tags: ["sweetspot", "time-trial", "continuous"],
  },

  // ── THRESHOLD ─────────────────────────────────────────────────────────────
  {
    name: "Short Threshold Intervals",
    category: "threshold",
    durationMin: 60,
    tss: 84,
    rationale: "Shorter intervals at full threshold (5-minute blocks) with minimal rest — accumulates threshold time without the psychological demands of 8-minute blocks.",
    structure: "12 min warmup → 6×5 min @ 100% FTP (2.5 min recovery @ 55%) → 18 min cooldown",
    executionCue: "The 2.5-minute recovery is deliberately short — designed to keep lactate elevated between reps.",
    successFeel: "All 6 reps completed at target power. The last 2-3 reps were the hardest.",
    tags: ["threshold", "accumulation"],
  },
  {
    name: "Threshold Development",
    category: "threshold",
    durationMin: 60,
    tss: 82,
    rationale: "Short blocks directly at lactate turn point; 8 minutes is long enough to maximally stress the system, short enough to complete all 4 with quality power output.",
    structure: "12 min warmup → 4×8 min @ 97-102% FTP (4 min recovery) → 12 min cooldown",
    executionCue: "Start block 1 at 97% — not 102%. By block 3, it should feel like 'this is hard but I can hold it.'",
    successFeel: "4 blocks completed, last block power within 5% of first.",
    tags: ["threshold", "ftp-builder", "zwift-ftp-builder"],
  },
  {
    name: "Threshold Cruise Intervals",
    category: "threshold",
    durationMin: 60,
    tss: 82,
    rationale: "5×5-minute blocks at threshold with short recovery — more total threshold time than 4×8 min, with shorter individual reps.",
    structure: "12 min warmup → 5×5 min @ 98-102% FTP (2.5 min recovery) → 13 min cooldown",
    executionCue: "The 2.5-minute recovery is intentionally short — you won't fully recover between reps.",
    successFeel: "Rep 5 should be genuinely hard.",
    tags: ["threshold", "intermediate"],
  },
  {
    name: "2×20 FTP Blocks",
    category: "threshold",
    durationMin: 70,
    tss: 98,
    rationale: "The gold-standard FTP benchmark session: two sustained 20-minute blocks at threshold reveal your true current ceiling.",
    structure: "15 min warmup → 2×20 min @ 97-100% FTP (8 min recovery) → 7 min cooldown",
    executionCue: "Start block 1 at 97% — your ego will want to go harder, don't.",
    successFeel: "If you completed both 20-minute blocks at target power, your FTP estimate is accurate.",
    tags: ["threshold", "advanced", "classic"],
  },
  {
    name: "Over-Under Intervals",
    category: "threshold",
    durationMin: 65,
    tss: 92,
    rationale: "Alternating just above and just below FTP trains the body to clear lactate while sustaining high power.",
    structure: "12 min warmup → 3×9 min cycling (3 min @ 105% / 3 min @ 93%) (5 min recovery) → 11 min cooldown",
    executionCue: "Don't ease below 90% during the 'under' phases — that defeats the purpose.",
    successFeel: "By rep 3, the 'over' phases feel genuinely hard.",
    tags: ["threshold", "advanced", "over-under"],
  },
  {
    name: "Descending Threshold",
    category: "threshold",
    durationMin: 65,
    tss: 90,
    rationale: "Decreasing interval lengths (12→10→8→6 min) stepping up 2% each block; builds mental resilience by ending with the most intense effort when most fatigued.",
    structure: "12 min warmup → 12 min @ 97% + 10 min @ 99% + 8 min @ 101% + 6 min @ 103% FTP (equal rest each) → 11 min cooldown",
    executionCue: "Each block gets shorter but steps up 2% in power. By the 6-minute final block, you should be at full threshold effort.",
    successFeel: "The 6-minute block at 103% feels like a sprint after exhausting work.",
    tags: ["threshold", "advanced", "mental-toughness"],
  },
  {
    name: "FTP Test Protocol",
    category: "threshold",
    durationMin: 60,
    tss: 90,
    rationale: "The standard field test for estimating FTP — a 20-minute all-out effort where 95% of average power estimates functional threshold.",
    structure: "15 min progressive warmup (include 3×1 min @ 110%) → 5 min easy → 20 min ALL OUT time trial → 20 min easy cooldown",
    executionCue: "Start the 20-minute effort conservatively — most riders go too hard in the first 5 minutes and blow up.",
    successFeel: "Completely exhausted at minute 20 — you should have nothing left.",
    tags: ["threshold", "test", "assessment"],
  },

  // ── VO2MAX ────────────────────────────────────────────────────────────────
  {
    name: "Micro Intervals",
    category: "vo2max",
    durationMin: 55,
    tss: 80,
    rationale: "Short 1-minute bursts at 115-120% FTP accumulate VO2max stress without the pacing discipline required by longer intervals.",
    structure: "12 min warmup → 12×1 min @ 115-120% FTP (1 min recovery) → 19 min cooldown",
    executionCue: "The 1:1 work:rest ratio keeps you returning before you're fully recovered. By rep 8, the recovery minute won't feel like enough.",
    successFeel: "The last 4 reps should be noticeably harder than the first 4.",
    tags: ["vo2max", "short-intervals"],
  },
  {
    name: "VO2max Pyramid",
    category: "vo2max",
    durationMin: 59,
    tss: 78,
    rationale: "Ascending and descending intervals (1-2-3-2-1 min) allow the rider to experience VO2max stress without committing to full 4-5 minute blocks.",
    structure: "15 min warmup → 1+2+3+2+1 min @ 115% FTP (2 min recovery between each) → 15 min cooldown",
    executionCue: "The 3-minute rep is the peak effort. 1-minute reps are warm-up intensity for the harder reps to come.",
    successFeel: "3-minute rep felt genuinely hard — near maximal.",
    tags: ["vo2max", "pyramid", "intro-vo2"],
  },
  {
    name: "60/60 Intervals",
    category: "vo2max",
    durationMin: 65,
    tss: 85,
    rationale: "60 seconds at VO2max power / 60 seconds easy — the equal work:rest ratio allows more total interval time at high intensity while maintaining quality.",
    structure: "15 min warmup → 3 sets of 6×(60s@115% / 60s@50%) with 5 min between sets → 8 min cooldown",
    executionCue: "115% FTP for 60 seconds — you should be working very hard. Never coast the rest periods.",
    successFeel: "18 reps completed. Set 3 was significantly harder than set 1.",
    tags: ["vo2max", "intermittent", "quality"],
  },
  {
    name: "4×4 Two-Set",
    category: "vo2max",
    durationMin: 65,
    tss: 85,
    rationale: "Two sets of 2×4-minute VO2max intervals — delivers the Norwegian 4-rep stimulus in a format more accessible for riders not yet ready for 4 consecutive hard reps.",
    structure: "12 min warmup → (2×4 min @ 108% / 4 min recovery) → 8 min easy Z2 → (2×4 min @ 108% / 4 min recovery) → 9 min cooldown",
    executionCue: "Use the 8-minute easy block genuinely — drop below 65% FTP.",
    successFeel: "All 4 reps completed at target power. Once this feels manageable rather than maximal, you're ready for Norwegian 4×4.",
    tags: ["vo2max", "intermediate", "norwegian-variant"],
  },
  {
    name: "Norwegian 4×4",
    category: "vo2max",
    durationMin: 60,
    tss: 90,
    rationale: "Gold-standard VO2max protocol; four 4-minute blocks at 106-110% FTP raise aerobic ceiling more efficiently than any other protocol.",
    structure: "12 min warmup → 4×4 min @ 106-110% FTP (4 min recovery) → 16 min cooldown",
    executionCue: "The first 2 minutes of each rep will feel manageable. The last 2 minutes are where the adaptation happens — HR climbs toward max and you must hold on.",
    successFeel: "By rep 4, you should barely be able to finish. If rep 4 felt like rep 2, the power target was too low.",
    tags: ["vo2max", "norwegian", "advanced"],
  },
  {
    name: "5×5 VO2max",
    category: "vo2max",
    durationMin: 70,
    tss: 100,
    rationale: "Five 5-minute blocks at VO2max intensity; 5 minutes is the optimal individual rep duration — long enough to fully stress the cardiovascular system.",
    structure: "15 min warmup → 5×5 min @ 108-112% FTP (5 min recovery) → 5 min cooldown",
    executionCue: "The equal work:rest ratio (5:5) is critical — don't rush the recovery.",
    successFeel: "Rep 5 is the hardest thing you'll do this week.",
    tags: ["vo2max", "zwift-build-me-up"],
  },
  {
    name: "3-Minute VO2max Repeats",
    category: "vo2max",
    durationMin: 65,
    tss: 88,
    rationale: "6×3 minute intervals at 114% FTP — one of the most effective VO2max formats in research literature.",
    structure: "15 min warmup → 6×3 min @ 114% FTP (3 min recovery @ 50%) → 14 min cooldown",
    executionCue: "Start each rep at 112% FTP, build to 114-116% by minute 2. The third minute of each rep should be genuinely maximal.",
    successFeel: "Rep 6 was the hardest thing you've done on the bike this week.",
    tags: ["vo2max", "research-backed"],
  },
  {
    name: "Seiler 4×8",
    category: "vo2max",
    durationMin: 70,
    tss: 92,
    rationale: "Stephen Seiler's extended VO2max protocol: 4×8 minutes at 106-108% FTP requiring sustained cardiac output at VO2max.",
    structure: "14 min warmup → 4×8 min @ 107% FTP (4 min recovery @ 50%) → 8 min cooldown",
    executionCue: "106-108% FTP for 8 full minutes — the last 2 minutes of each rep are where adaptation happens. HR should reach 90%+ of max by minute 6.",
    successFeel: "All 4 reps completed. HR peaked in the final 2 minutes of each rep.",
    tags: ["vo2max", "seiler", "extended-intervals", "advanced"],
  },
  {
    name: "40/20 Ronnestad",
    category: "vo2max",
    durationMin: 60,
    tss: 82,
    rationale: "Rønnestad's 40/20 protocol: 40 seconds at ~130% FTP with only 20 seconds rest. The compressed rest period keeps VO2 elevated for nearly the entire working interval.",
    structure: "15 min warmup → 3 sets of 10×(40s@130% / 20s@50%) with 5 min rest between sets → 10 min cooldown",
    executionCue: "130% FTP for 40 seconds is very hard. The 20-second rest is almost nothing — incomplete recovery is the design.",
    successFeel: "All 30 reps completed (3 sets × 10). Set 3 is significantly harder than set 1.",
    tags: ["vo2max", "ronnestad", "intermittent", "advanced"],
  },

  // ── NEUROMUSCULAR / STRENGTH ──────────────────────────────────────────────
  {
    name: "Sprint Builder",
    category: "neuromuscular",
    durationMin: 50,
    tss: 50,
    rationale: "15-20 second maximal efforts recruit fast-twitch muscle fibers — essential for neuromuscular development even in base phase.",
    structure: "15 min warmup → 8×15 s ALL OUT (2.5 min recovery) → 15 min Z2 flush",
    executionCue: "Each sprint is 100% — not 80%, not 90%. Think 'jump out of a corner' or 'bridge a gap now.' 2.5 full minutes between efforts is non-negotiable.",
    successFeel: "Your last sprint should produce nearly the same peak power as your first.",
    tags: ["neuromuscular", "sprint", "zwift-ftp-builder", "base-phase-ok"],
  },
  {
    name: "Race Day Opener",
    category: "neuromuscular",
    durationMin: 35,
    tss: 30,
    rationale: "Pre-event activation protocol — brief punchy efforts 24-48 hours before a race activate the neuromuscular system without adding meaningful fatigue.",
    structure: "10 min easy warmup → 3×1 min @ 110% FTP (3 min easy recovery) → 5 min @ 80% → 10 min easy spindown",
    executionCue: "Three 1-minute efforts at 110% FTP: sharp and decisive, not all-out sprints. These are neuromuscular 'reminders,' not training stimuli.",
    successFeel: "30-35 minutes and done. Legs feel awake and reactive.",
    tags: ["pre-event", "taper", "activation"],
  },

  // ── INTERMITTENT ──────────────────────────────────────────────────────────
  {
    name: "30/30 Blitz",
    category: "intermittent",
    durationMin: 60,
    tss: 78,
    rationale: "30s hard / 30s easy creates a metabolic double-hit: anaerobic stress in the 'on' intervals with aerobic recovery that can't fully clear before the next rep.",
    structure: "12 min warmup → 3 sets of 8×(30 s @ 120% / 30 s @ 50%) with 5 min set recovery → 14 min cooldown",
    executionCue: "The 'on' intervals are 120% FTP — hard effort, not sprint. The 30-second 'off' is active recovery at 50%; don't coast to zero.",
    successFeel: "Sets 1-2 are hard. Set 3 is very hard. Completing all 8 reps in set 3 at target power = success.",
    tags: ["intermittent", "zwift-ftp-builder"],
  },
  {
    name: "15/15 Micro-Intervals",
    category: "intermittent",
    durationMin: 50,
    tss: 65,
    rationale: "15 seconds hard / 15 seconds easy — very short work periods allow very high power targets with less total lactate accumulation than 30/30 or 40/20 formats.",
    structure: "12 min warmup → 4 sets of 10×(15s@135% / 15s@50%) with 4 min rest between sets → 10 min cooldown",
    executionCue: "135% FTP for 15 seconds — explosive but controlled. Never let power drop to zero during the rest period.",
    successFeel: "40 total reps completed. Power in last set was within 10% of first set.",
    tags: ["intermittent", "micro-intervals", "neuromuscular"],
  },
  {
    name: "40/20 HIIT",
    category: "intermittent",
    durationMin: 50,
    tss: 72,
    rationale: "40 seconds hard / 20 seconds easy at 120% FTP — similar to Ronnestad 40/20 but at slightly lower intensity, making it accessible at TSB -10 to -15.",
    structure: "12 min warmup → 4 sets of 8×(40s@120% / 20s@50%) with 4 min rest between sets → 11 min cooldown",
    executionCue: "120% FTP for 40 seconds — very hard but sustainable for all 8 reps per set.",
    successFeel: "32 total reps completed. Last set was the hardest but you finished all 8 reps.",
    tags: ["intermittent", "hiit", "moderate"],
  },
  {
    name: "Short Active Recovery",
    category: "recovery",
    durationMin: 20,
    tss: 12,
    rationale: "Ultra-short active recovery for days when time is scarce — just enough blood flow to accelerate muscle clearance without adding measurable training stress.",
    structure: "20 min continuous @ 45-55% FTP, free cadence, no structure",
    executionCue: "Keep power below 55% FTP at all times. If it feels too easy, that's correct — this is not training, it's biochemical maintenance.",
    successFeel: "Legs feel looser at minute 18 than at minute 2.",
    tags: ["recovery", "time-crunched", "beginner-friendly"],
  },
  {
    name: "Extended Recovery Flush",
    category: "recovery",
    durationMin: 50,
    tss: 33,
    rationale: "Longer recovery ride for days after two consecutive hard efforts — extended Z1 circulation allows more complete glycogen resynthesis.",
    structure: "10 min easy → 30 min pure Z1 @ 50-58% FTP → 10 min wind-down",
    executionCue: "Stay below 60% FTP regardless of how you feel.",
    successFeel: "Notable improvement in leg feel from start to finish.",
    tags: ["recovery", "post-hard-effort"],
  },
];

// ─── Phase Workout Selection ────────────────────────────────────────────────
export const PHASE_GUIDELINES = {
  Base: {
    focus: "aerobic foundation with 1-2 moderate intensity sessions",
    primary: ["Foundation Ride", "Long Endurance", "Two-Hour Foundation", "Z2 with Cadence Drills", "Sprint Builder", "Surge Ride", "Strength Endurance", "Endurance with Muscle Tension", "Sweet Spot Classic", "Sweet Spot Primer", "Tempo Cruise"],
    supporting: ["3×15 Sweet Spot", "Sub-Threshold Blocks", "Easy Flush", "Spin & Recover", "Short Active Recovery"],
    avoid: ["2×20 FTP Blocks", "Norwegian 4×4", "Over-Under Intervals", "5×5 VO2max", "Descending Threshold", "Seiler 4×8", "40/20 Ronnestad"],
    note: "70-80% Z1-Z2 volume. Sprint Builder is acceptable in base — short maximal efforts don't create lasting lactate accumulation. Include 1-2 sweet spot or tempo sessions per week for stimulus without excessive fatigue.",
  },
  Build: {
    focus: "FTP and VO2max development",
    primary: ["Sweet Spot Primer", "Sweet Spot Classic", "3×15 Sweet Spot", "Extended Sweet Spot", "Sweet Spot Progression", "Threshold Development", "Short Threshold Intervals", "Norwegian 4×4", "3-Minute VO2max Repeats"],
    supporting: ["Foundation Ride", "Long Endurance", "Tempo Cruise", "Sub-Threshold Blocks", "30/30 Blitz", "60/60 Intervals", "Micro Intervals", "4×4 Two-Set", "VO2max Pyramid"],
    avoid: [],
    note: "Progressive overload. 2-3 hard sessions per week maximum. Never increase volume AND intensity in the same week.",
  },
  Recovery: {
    focus: "adaptation and regeneration",
    primary: ["Short Active Recovery", "Spin & Recover", "Extended Recovery Flush", "Easy Flush", "Foundation Ride"],
    supporting: ["Tempo Cruise"],
    avoid: ["Threshold Development", "2×20 FTP Blocks", "Norwegian 4×4", "5×5 VO2max", "Over-Under Intervals", "Descending Threshold", "Extended Sweet Spot", "Sweet Spot Progression", "3×15 Sweet Spot", "Seiler 4×8"],
    note: "Volume cut 40-60%. At most one short easy activation. The body adapts DURING recovery weeks.",
  },
  Taper: {
    focus: "shed fatigue, keep race-pace sharpness, target event 2-3 weeks out",
    primary: ["Foundation Ride", "Tempo Cruise", "Sweet Spot Classic"],
    supporting: ["Long Endurance", "Micro Intervals", "Surge Ride"],
    avoid: ["Norwegian 4×4", "2×20 FTP Blocks", "Over-Under Intervals", "5×5 VO2max", "Descending Threshold", "Extended Sweet Spot"],
    note: "Cut total volume ~20-30%. Keep 1-2 SHORT touches of race-pace intensity. When in doubt, cut duration before cutting intensity.",
  },
  RaceWeek: {
    focus: "arrive fresh, event this week or next",
    primary: ["Spin & Recover", "Race Day Opener"],
    supporting: ["Foundation Ride"],
    avoid: ["Threshold Development", "2×20 FTP Blocks", "Norwegian 4×4", "5×5 VO2max", "Over-Under Intervals", "Extended Sweet Spot", "Sweet Spot Classic", "30/30 Blitz"],
    note: "No new training stress. Short easy rides only, plus one 'Race Day Opener' 1-2 days before the event.",
  },
} as const;

export const PROGRESSION_LADDER = [
  "Foundation Ride",
  "Two-Hour Foundation",
  "Tempo Cruise",
  "Sub-Threshold Blocks",
  "Sweet Spot Primer",
  "Sweet Spot Classic",
  "3×15 Sweet Spot",
  "Sweet Spot Progression",
  "Extended Sweet Spot",
  "Short Threshold Intervals",
  "Threshold Development",
  "Threshold Cruise Intervals",
  "Over-Under Intervals",
  "VO2max Pyramid",
  "4×4 Two-Set",
  "Norwegian 4×4",
  "3-Minute VO2max Repeats",
  "5×5 VO2max",
  "Seiler 4×8",
  "2×20 FTP Blocks",
] as const;

// ─── Canonical Workout Structure Blocks ────────────────────────────────────
export interface CanonicalWorkoutEntry {
  totalMin: number;
  blocks: WorkoutStructureBlock[];
}

export const CANONICAL_WORKOUT_STRUCTURES: Record<string, CanonicalWorkoutEntry> = {
  "Spin & Recover": {
    totalMin: 30,
    blocks: [
      { type: "warmup",      durationMin: 3,  powerFtp: 0.55, label: "Easy spin in" },
      { type: "steadystate", durationMin: 24, powerFtp: 0.55, label: "Z1 active recovery @ 50-60% FTP, 90+ rpm" },
      { type: "cooldown",    durationMin: 3,  powerFtp: 0.50, label: "Easy spin out" },
    ],
  },
  "Easy Flush": {
    totalMin: 45,
    blocks: [
      { type: "warmup",      durationMin: 10, powerFtp: 0.55, label: "Easy warm-up" },
      { type: "steadystate", durationMin: 25, powerFtp: 0.55, label: "Z1 @ 55% FTP" },
      { type: "cooldown",    durationMin: 10, powerFtp: 0.50, label: "Easy cool-down" },
    ],
  },
  "Foundation Ride": {
    totalMin: 60,
    blocks: [
      { type: "warmup",      durationMin: 10, powerFtp: 0.65, label: "Easy warm-up" },
      { type: "steadystate", durationMin: 40, powerFtp: 0.69, label: "Z2 @ 65-73% FTP" },
      { type: "cooldown",    durationMin: 10, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Long Endurance": {
    totalMin: 90,
    blocks: [
      { type: "warmup",      durationMin: 15, powerFtp: 0.65, label: "Easy warm-up" },
      { type: "steadystate", durationMin: 65, powerFtp: 0.69, label: "Z2 @ 65-73% FTP" },
      { type: "cooldown",    durationMin: 10, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Two-Hour Foundation": {
    totalMin: 120,
    blocks: [
      { type: "warmup",      durationMin: 20, powerFtp: 0.65, label: "Progressive warm-up" },
      { type: "steadystate", durationMin: 85, powerFtp: 0.69, label: "Z2 @ 65-73% FTP — main aerobic stimulus" },
      { type: "cooldown",    durationMin: 15, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Z2 with Cadence Drills": {
    totalMin: 60,
    blocks: [
      { type: "warmup",    durationMin: 10, powerFtp: 0.68, label: "Easy warm-up" },
      { type: "intervals", durationMin: 40, powerFtp: 0.68, recoveryPowerFtp: 0.65,
        repeats: 4, onSec: 480, offSec: 120,
        label: "4×8 min Z2 + 2 min cadence drill (100-110 rpm)" },
      { type: "cooldown",  durationMin: 10, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Surge Ride": {
    totalMin: 60,
    blocks: [
      { type: "warmup",    durationMin: 12, powerFtp: 0.68, label: "Easy warm-up" },
      { type: "intervals", durationMin: 36, powerFtp: 1.10, recoveryPowerFtp: 0.68,
        repeats: 6, onSec: 60, offSec: 300,
        label: "6×1 min surges @ 110% FTP" },
      { type: "cooldown",  durationMin: 12, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Tempo Cruise": {
    totalMin: 60,
    blocks: [
      { type: "warmup",    durationMin: 10, powerFtp: 0.70, label: "Easy warm-up" },
      { type: "intervals", durationMin: 40, powerFtp: 0.80, recoveryPowerFtp: 0.58,
        repeats: 2, onSec: 900, offSec: 300,
        label: "2×15 min @ 80% FTP" },
      { type: "cooldown",  durationMin: 10, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Sweet Spot Classic": {
    totalMin: 60,
    blocks: [
      { type: "warmup",    durationMin: 10, powerFtp: 0.70, label: "Easy warm-up" },
      { type: "intervals", durationMin: 42, powerFtp: 0.90, recoveryPowerFtp: 0.50,
        repeats: 3, onSec: 600, offSec: 240,
        label: "3×10 min @ 90% FTP" },
      { type: "cooldown",  durationMin: 8,  powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Extended Sweet Spot": {
    totalMin: 75,
    blocks: [
      { type: "warmup",    durationMin: 15, powerFtp: 0.70, label: "Easy warm-up" },
      { type: "intervals", durationMin: 56, powerFtp: 0.90, recoveryPowerFtp: 0.52,
        repeats: 2, onSec: 1200, offSec: 480,
        label: "2×20 min @ 90% FTP" },
      { type: "cooldown",  durationMin: 4,  powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Threshold Development": {
    totalMin: 60,
    blocks: [
      { type: "warmup",    durationMin: 8,  powerFtp: 0.72, label: "Easy warm-up" },
      { type: "intervals", durationMin: 48, powerFtp: 1.00, recoveryPowerFtp: 0.52,
        repeats: 4, onSec: 480, offSec: 240,
        label: "4×8 min @ 100% FTP" },
      { type: "cooldown",  durationMin: 4,  powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "2×20 FTP Blocks": {
    totalMin: 70,
    blocks: [
      { type: "warmup",    durationMin: 10, powerFtp: 0.72, label: "Easy warm-up" },
      { type: "intervals", durationMin: 54, powerFtp: 0.98, recoveryPowerFtp: 0.52,
        repeats: 2, onSec: 1200, offSec: 420,
        label: "2×20 min @ 98% FTP (gold standard threshold session)" },
      { type: "cooldown",  durationMin: 6,  powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Norwegian 4×4": {
    totalMin: 60,
    blocks: [
      { type: "warmup",    durationMin: 12, powerFtp: 0.70, label: "Easy warm-up" },
      { type: "intervals", durationMin: 32, powerFtp: 1.08, recoveryPowerFtp: 0.52,
        repeats: 4, onSec: 240, offSec: 240,
        label: "4×4 min @ 108% FTP (95+ rpm — HR must plateau in last 2 min each rep)" },
      { type: "cooldown",  durationMin: 16, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "5×5 VO2max": {
    totalMin: 70,
    blocks: [
      { type: "warmup",    durationMin: 15, powerFtp: 0.70, label: "Easy warm-up" },
      { type: "intervals", durationMin: 50, powerFtp: 1.10, recoveryPowerFtp: 0.52,
        repeats: 5, onSec: 300, offSec: 300,
        label: "5×5 min @ 110% FTP (equal work:rest — don't rush the recovery)" },
      { type: "cooldown",  durationMin: 5,  powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
  "Sprint Builder": {
    totalMin: 50,
    blocks: [
      { type: "warmup",    durationMin: 15, powerFtp: 0.70, label: "Easy warm-up" },
      { type: "intervals", durationMin: 22, powerFtp: 1.50, recoveryPowerFtp: 0.52,
        repeats: 8, onSec: 15, offSec: 150,
        label: "8×15 s all-out sprints (last sprint near-equal to first in peak power)" },
      { type: "cooldown",  durationMin: 13, powerFtp: 0.52, label: "Z2 flush cool-down" },
    ],
  },
  "Race Day Opener": {
    totalMin: 35,
    blocks: [
      { type: "warmup",      durationMin: 10, powerFtp: 0.65, label: "Easy warm-up" },
      { type: "intervals",   durationMin: 12, powerFtp: 1.10, recoveryPowerFtp: 0.55,
        repeats: 3, onSec: 60, offSec: 180,
        label: "3×1 min @ 110% FTP (activation — sharp, not all-out)" },
      { type: "steadystate", durationMin: 5,  powerFtp: 0.78, label: "5 min @ 80% FTP" },
      { type: "cooldown",    durationMin: 8,  powerFtp: 0.55, label: "Easy spin-down" },
    ],
  },
  "30/30 Blitz": {
    totalMin: 60,
    blocks: [
      { type: "warmup",      durationMin: 12, powerFtp: 0.70, label: "Easy warm-up" },
      { type: "intervals",   durationMin: 8,  powerFtp: 1.20, recoveryPowerFtp: 0.50,
        repeats: 8, onSec: 30, offSec: 30,
        label: "Set 1: 8×30s @ 120% FTP" },
      { type: "steadystate", durationMin: 5,  powerFtp: 0.52, label: "5 min set recovery" },
      { type: "intervals",   durationMin: 8,  powerFtp: 1.20, recoveryPowerFtp: 0.50,
        repeats: 8, onSec: 30, offSec: 30,
        label: "Set 2: 8×30s @ 120% FTP" },
      { type: "steadystate", durationMin: 5,  powerFtp: 0.52, label: "5 min set recovery" },
      { type: "intervals",   durationMin: 8,  powerFtp: 1.20, recoveryPowerFtp: 0.50,
        repeats: 8, onSec: 30, offSec: 30,
        label: "Set 3: 8×30s @ 120% FTP (this set should hurt)" },
      { type: "cooldown",    durationMin: 14, powerFtp: 0.55, label: "Easy cool-down" },
    ],
  },
};

export function resolveCanonicalStructure(
  name: string,
  targetMin?: number,
): WorkoutStructureBlock[] | null {
  const canonical = CANONICAL_WORKOUT_STRUCTURES[name];
  if (!canonical) return null;

  const target = targetMin ?? canonical.totalMin;
  const delta = target - canonical.totalMin;

  if (Math.abs(delta) <= 8) {
    if (delta === 0) return canonical.blocks;
    const workBlocks = canonical.blocks.filter(
      (b) => b.type !== "warmup" && b.type !== "cooldown"
    );
    const workTotal = workBlocks.reduce((s, b) => s + b.durationMin, 0);
    const available = target - workTotal;
    if (available < 8) return canonical.blocks;
    const warmupMin = Math.max(5, Math.round(available * 0.6));
    const cooldownMin = Math.max(3, available - warmupMin);
    return canonical.blocks.map((b) => {
      if (b.type === "warmup")   return { ...b, durationMin: warmupMin };
      if (b.type === "cooldown") return { ...b, durationMin: cooldownMin };
      return b;
    });
  }

  return null;
}

/**
 * Condensed workout library injected into the AI system prompt.
 * Keep this in sync with WORKOUT_LIBRARY above.
 */
export const WORKOUT_LIBRARY_PROMPT = `
NAMED WORKOUT PROTOCOLS — use these exact names as session titles. Choose from this library every time.

RECOVERY:
• "Spin & Recover" — 30 min, Z1 @ 50-60% FTP. Legs should feel better by minute 25 than minute 5.
• "Easy Flush" — 45 min, 25 min Z1 @ 55% FTP. More volume than Spin & Recover; purely physiological clearance.
• "Short Active Recovery" — 20 min, ultra-light @ 45-55% FTP. For time-crunched days.
• "Extended Recovery Flush" — 50 min, 30 min Z1 @ 50-58% FTP. After two consecutive hard efforts.

ENDURANCE / FOUNDATION (Z2 — 56-75% FTP):
• "Foundation Ride" — 60 min, Z2 @ 65-73% FTP. Primary aerobic base builder and hard-session bookend.
• "Long Endurance" — 90 min, Z2 @ 65-73% FTP. Higher volume stimulus.
• "Two-Hour Foundation" — 120 min, Z2 @ 65-73% FTP. The cornerstone of long-term aerobic development.
• "Z2 with Cadence Drills" — 60 min, 4× (8 min Z2 + 2 min cadence drills @ 100-110 rpm).
• "Surge Ride" — 60 min, Z2 base with 6×1 min surges @ 110% FTP.
• "Endurance with Muscle Tension" — 65 min, Z2 base with 4×5 min low-cadence blocks @ 55 rpm.

TEMPO (Z3 — 76-90% FTP, always appropriate):
• "Tempo Cruise" — 60 min (10 warmup → 2×15 min @ 80% / 5 rec → 15 cooldown).
• "Tempo Ladder" — 75 min (12 warmup → 10+15+20 min @ 80% / 5 rec → 8 cooldown).
• "Sub-Threshold Blocks" — 75 min (12 warmup → 3×15 min @ 88% / 5 min rec → 3 cooldown). Bridge to threshold.
• "Strength Endurance" — 65 min (15 warmup → 3×8 min @ 81% FTP / 55-65 rpm / 4 min rec → 14 cooldown).

SWEET SPOT (88-93% FTP — requires TSB ≥ -20):
• "Sweet Spot Primer" — 55 min (12 warmup → 4×7 min @ 88% / 3 min rec → 11 cooldown). Beginner entry.
• "Sweet Spot Classic" — 60 min (10 warmup → 3×10 min @ 90% / 4 rec → 8 cooldown). Cornerstone.
• "3×15 Sweet Spot" — 75 min (12 warmup → 3×15 min @ 90% / 5 rec → 3 cooldown).
• "Extended Sweet Spot" — 75 min (15 warmup → 2×20 min @ 90% / 8 rec → 4 cooldown).
• "Sweet Spot Progression" — 70 min (12 warmup → 10+15+20 min @ 90% / 5 each → 3 cooldown).
• "Sweet Spot Time Trial" — 65 min (12 warmup → 35 min continuous @ 89% → 18 cooldown).

THRESHOLD (97-105% FTP — requires TSB ≥ -12):
• "Short Threshold Intervals" — 60 min (12 warmup → 6×5 min @ 100% / 2.5 rec → 3 cooldown).
• "Threshold Development" — 60 min (8 warmup → 4×8 min @ 100% / 4 rec → 4 cooldown).
• "Threshold Cruise Intervals" — 60 min (12 warmup → 5×5 min @ 100% / 2.5 rec → 10.5 cooldown).
• "2×20 FTP Blocks" — 70 min (10 warmup → 2×20 min @ 98% / 7 rec → 6 cooldown). Gold standard.
• "Over-Under Intervals" — 65 min (12 warmup → 3×9 min cycling 3 min@105%/3 min@93% / 5 rec → 11 cooldown).
• "Descending Threshold" — 65 min (12 warmup → 12+10+8+6 min stepping 97→103% / 4 rec each → 5 cooldown).
• "FTP Test Protocol" — 60 min (15 progressive warmup → 5 min easy → 20 min ALL OUT → 20 min cooldown). Assessment only.

VO2MAX (106-120% FTP — requires TSB ≥ -5 and intermediate+ rider):
• "Micro Intervals" — 55 min (12 warmup → 12×1 min @ 117% / 1 rec → 19 cooldown). Entry-level VO2max.
• "VO2max Pyramid" — 59 min (15 warmup → 1+2+3+2+1 min @ 115% / 2 rec each → 27 cooldown).
• "60/60 Intervals" — 65 min (15 warmup → 3 sets of 6×(60s@115% / 60s@50%) / 5 set-rest → 4 cooldown).
• "4×4 Two-Set" — 65 min (12 warmup → [2×4 min@108%/4 rec] + 8 Z2 + [2×4 min@108%/4 rec] → 13 cooldown).
• "Norwegian 4×4" — 60 min (12 warmup → 4×4 min @ 108% / 4 rec → 16 cooldown). Last 2 min MUST be hard.
• "3-Minute VO2max Repeats" — 65 min (15 warmup → 6×3 min @ 114% / 3 rec → 14 cooldown).
• "5×5 VO2max" — 70 min (15 warmup → 5×5 min @ 110% / 5 rec → 5 cooldown).
• "40/20 Ronnestad" — 60 min (15 warmup → 3 sets of 10×(40s@130% / 20s@50%) / 5 set-rest → 5 cooldown). Advanced only.
• "Seiler 4×8" — 70 min (14 warmup → 4×8 min @ 107% / 4 rec → 8 cooldown). Advanced only.

NEUROMUSCULAR (acceptable even in Base — minimal lactate):
• "Sprint Builder" — 50 min (15 warmup → 8×15s ALL OUT ~150% FTP / 2.5 min rec → 13 Z2 flush).
• "Race Day Opener" — 35 min (10 warmup → 3×1 min @ 110% / 3 min easy → 5 min @ 80% → 8 spindown). Pre-event only.

INTERMITTENT (requires TSB ≥ -8):
• "15/15 Micro-Intervals" — 50 min (12 warmup → 4 sets of 10×(15s@135% / 15s@50%) / 4 set-rest → 6 cooldown).
• "30/30 Blitz" — 60 min (12 warmup → 3 sets of 8×(30s@120% / 30s@50%) / 5 set-rest → 14 cooldown).
• "40/20 HIIT" — 50 min (12 warmup → 3 sets of 8×(40s@120% / 20s@50%) / 4 set-rest → 6 cooldown). TSB ≥ -8.

QUALITY GATE — before returning any plan:
1. Count hard-intensity sessions (≥88% FTP). Base: max 1. Build: target 2.
2. Never two hard sessions on consecutive days.
3. Recovery week: volume cut 40-60%, no hard sessions.
4. Session count must match rider's ACTUAL recent frequency, not an ideal.
`.trim();
