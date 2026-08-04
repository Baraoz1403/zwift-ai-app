/**
 * Core test — runs the coaching engine directly, no UI needed.
 * Run: node test-core.mjs
 *
 * Tests:
 *  1. Quality gate rejects a bad plan
 *  2. Quality gate passes a good plan
 *  3. Anthropic API call generates a real plan (if API key present)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '.env.local');
const env = readFileSync(envPath, 'utf8');
const apiKey = env.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();

console.log('\n=== Zwift AI Core Test ===\n');
console.log('API key present:', apiKey ? `${apiKey.slice(0, 20)}...` : 'MISSING');

// ── Test 1: Quality gate — bad plan ──────────────────────────────────────────
console.log('\n--- Test 1: Quality gate rejects bad plan ---');

const badPlan = {
  weekOf: '2026-07-20',
  workouts: [
    { day: 'monday',    dayType: 'training', workoutName: 'Easy ride',   blocks: [] },
    { day: 'tuesday',   dayType: 'training', workoutName: 'Easy ride',   blocks: [] },
    { day: 'wednesday', dayType: 'training', workoutName: 'Easy ride',   blocks: [] },
    { day: 'thursday',  dayType: 'training', workoutName: 'Easy ride',   blocks: [] },
    { day: 'friday',    dayType: 'rest' },
    { day: 'saturday',  dayType: 'rest' },
    { day: 'sunday',    dayType: 'rest' },
  ],
  totalTSS: 50,
};

// Inline quality gate (mirrors quality-gate.ts logic)
function validatePlan(plan, ctl = 50, phase = 'base') {
  const failures = [];
  const details = [];

  // Check: training days must have interval blocks
  for (const w of plan.workouts) {
    if (w.dayType !== 'training') continue;
    const blocks = w.blocks ?? [];
    const hasIntervals = blocks.some(b => b.type === 'intervals');
    if (!hasIntervals) {
      failures.push('trainingDayWithoutIntervals');
      details.push(`${w.day}: training day has no interval blocks`);
    }
  }

  // Check: no more than 3 consecutive training days
  let consecutive = 0;
  for (const w of plan.workouts) {
    if (w.dayType === 'training') {
      consecutive++;
      if (consecutive > 3) {
        failures.push('tooManyConsecutiveTrainingDays');
        details.push(`More than 3 consecutive training days`);
        break;
      }
    } else {
      consecutive = 0;
    }
  }

  // Check: weekly TSS in range (very simplified)
  const total = plan.totalTSS ?? 0;
  const minTSS = Math.round(ctl * 0.8);
  const maxTSS = Math.round(ctl * 1.5);
  if (total > 0 && (total < minTSS || total > maxTSS)) {
    failures.push('weeklyTSSOutOfRange');
    details.push(`TSS ${total} outside range ${minTSS}–${maxTSS}`);
  }

  return { passed: failures.length === 0, failures: [...new Set(failures)], details };
}

const badResult = validatePlan(badPlan);
console.log('Bad plan passed?', badResult.passed, '← should be false');
console.log('Failures:', badResult.failures);
console.log('Details:', badResult.details);

if (!badResult.passed && badResult.failures.includes('trainingDayWithoutIntervals')) {
  console.log('✅ PASS — quality gate correctly rejected bad plan');
} else {
  console.log('❌ FAIL — quality gate missed the error');
}

// ── Test 2: Quality gate — good plan ─────────────────────────────────────────
console.log('\n--- Test 2: Quality gate passes good plan ---');

const goodPlan = {
  weekOf: '2026-07-20',
  workouts: [
    {
      day: 'monday', dayType: 'training', workoutName: 'Sweet Spot Classic',
      estimatedTSS: 78,
      blocks: [
        { type: 'warmup',    durationMin: 10, powerPct: 0.60 },
        { type: 'intervals', durationMin: 30, powerPct: 0.88, reps: 3 },
        { type: 'cooldown',  durationMin: 10, powerPct: 0.55 },
      ],
    },
    { day: 'tuesday',   dayType: 'rest' },
    {
      day: 'wednesday', dayType: 'training', workoutName: 'Threshold Repeats',
      estimatedTSS: 85,
      blocks: [
        { type: 'warmup',    durationMin: 15, powerPct: 0.65 },
        { type: 'intervals', durationMin: 20, powerPct: 0.98, reps: 4 },
        { type: 'cooldown',  durationMin: 10, powerPct: 0.55 },
      ],
    },
    { day: 'thursday',  dayType: 'recovery', estimatedTSS: 30,
      blocks: [{ type: 'steady', durationMin: 45, powerPct: 0.55 }] },
    { day: 'friday',    dayType: 'rest' },
    {
      day: 'saturday', dayType: 'training', workoutName: 'Endurance Base',
      estimatedTSS: 90,
      blocks: [
        { type: 'warmup',    durationMin: 10, powerPct: 0.60 },
        { type: 'intervals', durationMin: 60, powerPct: 0.72, reps: 1 },
        { type: 'cooldown',  durationMin: 10, powerPct: 0.55 },
      ],
    },
    { day: 'sunday', dayType: 'rest' },
  ],
  totalTSS: 283,
};

const goodResult = validatePlan(goodPlan, 200, 'base');
console.log('Good plan passed?', goodResult.passed, '← should be true');
if (goodResult.passed) {
  console.log('✅ PASS — quality gate correctly approved good plan');
} else {
  console.log('❌ FAIL — quality gate rejected good plan');
  console.log('Failures:', goodResult.details);
}

// ── Test 3: Anthropic API call ────────────────────────────────────────────────
console.log('\n--- Test 3: Anthropic API — generate real plan ---');

if (!apiKey) {
  console.log('⚠️  Skipped — no API key');
} else {
  console.log('Calling Anthropic claude-opus-4-8...');

  const prompt = `You are an elite cycling coach. Generate a 7-day training plan for an athlete with FTP 250W, weight 75kg, CTL 55, TSB +5 (fresh), in Base phase.

Return ONLY valid JSON:
{
  "weekOf": "2026-07-20",
  "targetTSS": 280,
  "workouts": [
    {
      "day": "monday",
      "dayType": "training|recovery|rest",
      "workoutName": "Name from library",
      "workoutType": "sweet-spot",
      "estimatedTSS": 78,
      "blocks": [
        { "type": "warmup", "durationMin": 10, "powerPct": 0.65 },
        { "type": "intervals", "durationMin": 30, "powerPct": 0.88, "reps": 3 },
        { "type": "cooldown", "durationMin": 10, "powerPct": 0.55 }
      ]
    }
  ]
}

Rules:
- Every training day MUST have warmup + intervals + cooldown blocks
- Max 3 consecutive training days
- 3-4 training days total
- TSS range 250-350`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const plan = JSON.parse(jsonMatch[0]);
    console.log('Plan received — weekOf:', plan.weekOf);
    console.log('Workouts:', plan.workouts?.length, 'days');

    const aiResult = validatePlan(plan, 55, 'base');
    console.log('Quality gate passed?', aiResult.passed);
    if (!aiResult.passed) {
      console.log('Failures:', aiResult.details);
    }

    // Print summary
    console.log('\nPlan summary:');
    for (const w of plan.workouts ?? []) {
      const blocks = w.blocks?.map(b => b.type).join('→') ?? '-';
      console.log(`  ${w.day.padEnd(10)} [${w.dayType.padEnd(8)}] ${(w.workoutName ?? '').padEnd(25)} TSS:${w.estimatedTSS ?? 0} | ${blocks}`);
    }

    if (aiResult.passed) {
      console.log('\n✅ PASS — AI generated a valid plan that passed quality gate');
    } else {
      console.log('\n⚠️  Plan generated but failed quality gate —', aiResult.failures.join(', '));
    }

  } catch (err) {
    console.log('❌ ERROR:', err.message);
  }
}

console.log('\n=== Test complete ===\n');
