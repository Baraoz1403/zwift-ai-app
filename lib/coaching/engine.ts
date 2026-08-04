/**
 * Coaching Engine — generates a weekly training plan via Anthropic Claude.
 *
 * Flow:
 *  1. Build prompt from rider context  (prompt-builder.ts)
 *  2. Call Claude claude-opus-4-8
 *  3. Parse the JSON response
 *  4. Validate through quality gate  (quality-gate.ts)
 *  5. If validation fails → build retry prompt with diagnostic → go to step 2
 *  6. Return the validated plan (or throw after MAX_RETRIES)
 *
 * The quality gate is enforced in code. The AI cannot bypass it.
 * If the AI generates an invalid plan MAX_RETRIES times in a row,
 * we throw a hard error — never silently return a bad plan.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, type PromptContext } from './prompt-builder';
import { validatePlan, buildRetryDiagnostic, type WeeklyPlan } from './quality-gate';
import type { TrainingPhase } from '../knowledge/periodization';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const MODEL = 'claude-opus-4-8';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateResult {
  plan: WeeklyPlan;
  phase: TrainingPhase;
  wkg: number | null;
  /** How many retries were needed (0 = succeeded on first attempt) */
  retries: number;
  /** The final prompts sent (useful for debugging / logging) */
  finalPrompt: { systemPrompt: string; userPrompt: string };
}

export interface EngineOptions {
  /**
   * Anthropic API key. Read from environment:
   *   process.env.ANTHROPIC_API_KEY
   */
  anthropicApiKey: string;

  /**
   * Optional: override the model.
   * Defaults to claude-opus-4-8.
   */
  model?: string;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export async function generateWeeklyPlan(
  ctx: PromptContext,
  opts: EngineOptions,
): Promise<GenerateResult> {
  const client = new Anthropic({ apiKey: opts.anthropicApiKey });
  const model = opts.model ?? MODEL;

  let retries = 0;
  let lastDiagnostic: string | undefined;

  while (retries <= MAX_RETRIES) {
    // Build prompt (inject retry diagnostic on subsequent attempts)
    const built = buildPrompt({
      ...ctx,
      retryDiagnostic: lastDiagnostic,
    });

    // Call Claude
    let rawJson: string;
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: built.systemPrompt,
        messages: [
          { role: 'user', content: built.userPrompt },
        ],
      });

      const block = response.content[0];
      rawJson = block.type === 'text' ? block.text : '';
    } catch (err) {
      throw new EngineError(
        `Anthropic API call failed: ${err instanceof Error ? err.message : String(err)}`,
        'API_ERROR',
        retries,
      );
    }

    // Parse JSON
    let plan: WeeklyPlan;
    try {
      plan = parsePlan(rawJson);
    } catch (err) {
      // Malformed JSON counts as a retry
      lastDiagnostic = `Plan response was not valid JSON: ${err instanceof Error ? err.message : String(err)}. Respond with pure JSON only.`;
      retries++;
      continue;
    }

    // Validate through quality gate
    const result = validatePlan(plan, {
      ctl: ctx.load.ctl,
      phase: built.phase,
    });

    if (result.passed) {
      return {
        plan,
        phase: built.phase,
        wkg: built.wkg,
        retries,
        finalPrompt: { systemPrompt: built.systemPrompt, userPrompt: built.userPrompt },
      };
    }

    // Quality gate failed — build diagnostic and retry
    lastDiagnostic = buildRetryDiagnostic(result);
    retries++;
  }

  // Exhausted retries
  throw new EngineError(
    `Plan generation failed quality gate after ${MAX_RETRIES} attempts. Last diagnostic:\n${lastDiagnostic}`,
    'QUALITY_GATE_EXHAUSTED',
    retries,
  );
}

// ─── Plan parser ──────────────────────────────────────────────────────────────

/**
 * Parse and lightly normalize the AI's JSON output into a WeeklyPlan.
 * Throws if the JSON is structurally invalid.
 */
function parsePlan(raw: string): WeeklyPlan {
  const data = JSON.parse(raw); // throws on invalid JSON

  if (!data || typeof data !== 'object') {
    throw new Error('Expected a JSON object at root level');
  }

  if (!Array.isArray(data.workouts)) {
    throw new Error('Missing or invalid "workouts" array');
  }

  // Normalize weekOf
  const weekOf: string = data.weekOf ?? new Date().toISOString().slice(0, 10);

  // Compute total TSS
  const totalTSS = (data.workouts as Array<{ estimatedTSS?: number }>)
    .reduce((sum, w) => sum + (w.estimatedTSS ?? 0), 0);

  return {
    weekOf,
    workouts: data.workouts,
    totalTSS: data.targetTSS ?? totalTSS,
  };
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_ERROR' | 'QUALITY_GATE_EXHAUSTED' | 'PARSE_ERROR',
    public readonly attempts: number,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
