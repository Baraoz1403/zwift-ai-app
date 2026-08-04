# CLAUDE.md — Developer Rules for zwift-ai-app

Read this before making any changes. These rules override default behavior.

---

## Project spirit

This app is built to serve a serious cyclist, not an IT department. Every hour
debugging a recurring bug is an hour stolen from training.

**Permanent fixes, not patches.** Understand why a bug happens, close that door.
Before committing any fix, ask: what would have to be true for this to recur?

**Initiative over instruction.** If something looks fragile — fix it or flag it.
The user shouldn't discover the same failure twice.

**Own the outcome.** "I made the change" is not done. "The feature works correctly"
is done. Check deploys, think through edge cases, catch regressions.

**Full transparency.** Report exactly what happened — not what you intended. If
something failed, say so. If something is uncertain, say so. If a fix only partially
worked, report what's still open.

**Verify before reporting — non-negotiable.** Every claim must be verified before
being reported. A file was edited → Read it back. A bug was fixed → Confirm the fix
is in the file. "Done" means checked, not intended.

---

## Project overview

A React Native / Expo app for personalized cycling and running training plans.

- **Framework**: React Native + Expo SDK 53, Expo Router (file-based navigation)
- **Language**: TypeScript throughout
- **AI**: OpenAI GPT-4o via `lib/ai/` for plan generation
- **Storage**: AsyncStorage (local) + Vercel KV (server-side cache)
- **Training data**: Intervals.icu API (`lib/api/icu.ts`) + Zwift API (`lib/api/zwift.ts`)
- **Coaching engine**: `lib/knowledge/coaching-knowledge.ts`, `lib/coaching/quality-gate.ts`
- **ZWO files**: `lib/zwo.ts` — workout XML generation for Zwift import

---

## Language rule

Conversation language and product language are separate. The user talks to Claude
in Hebrew. All UI text, button labels, error messages, and alert strings in the
app must stay in **English**. Hebrew conversation must never leak into component
strings.

---

## File editing rules

### Always use Edit or Write — never bash for file edits

This project lives on a Windows/OneDrive mount. Bash `sed -i` and shell redirects
do NOT persist to the real files. Always use the `Edit` or `Write` tool.

### Bash views can be stale

After a recent edit, bash's cached view of a file may lag. When verifying a change
you just made, trust `Read`/`Grep` output over bash. If they disagree, `Read` is right.

### Cloud-only files

Some files under `lib/` may only exist in OneDrive cloud (not locally cached to
disk). Bash can't see them. Use `Read` tool — it downloads on demand.

---

## Architecture

```
app/                  — Expo Router screens (file-based routing)
  (tabs)/             — Main tab navigator
  onboarding/         — First-run profile setup
lib/
  api/                — External API clients (icu.ts, zwift.ts)
  ai/                 — OpenAI integration + prompt assembly
  coaching/           — Plan generation, quality-gate, session selection
  knowledge/          — Workout library, rider profile, power zones
  zwo.ts              — ZWO XML workout file generation
  training-load.ts    → (in lib/coaching/) ATL/CTL/TSB model
components/           — Shared UI components
docs/
  SPEC.md             — Full functional specification
  ARCHITECTURE.md     — Technical architecture decisions
  training-knowledge/ — Coaching methodology reference documents
```

### Key interfaces

- `RiderProfile` (`lib/knowledge/rider-profile.ts`) — who the rider is and what they want
- `ActivitySummary` (`lib/coaching/training-load.ts`) — a single ride/run for load calcs
- `TrainingLoadSummary` — CTL, ATL, TSB, freshness
- `NamedWorkout` / `WORKOUT_LIBRARY` (`lib/knowledge/coaching-knowledge.ts`) — 40+ protocols
- `WorkoutStructureBlock` (`lib/zwo.ts`) — block-level workout description
- `ZwoWorkoutInput` (`lib/zwo.ts`) — full ZWO file spec

---

## Coaching constraints (⛔ non-negotiable)

**The workout library is a canon — not a catalog.**

Every session the AI generates must be:
1. Built block by block (warmup → intervals/steady-state → cooldown) with exact % FTP values
2. Matched to a named workout from `WORKOUT_LIBRARY` in `coaching-knowledge.ts`
3. Physiologically justified per the `PHASE_GUIDELINES` for the current training phase
4. Validated by `quality-gate.ts` before being returned to the user

Never pick a template and change numbers. Every workout = fresh assembly from blocks.

**Quality gate rules (enforced in `lib/coaching/quality-gate.ts`):**
- Hard sessions (≥88% FTP): max 1 in Base phase, max 2 in Build phase
- No two hard sessions on consecutive days
- Recovery week: volume cut 40-60%, no hard sessions
- Session count must not exceed rider's actual recent frequency

---

## Common mistakes to avoid

| Mistake | Correct approach |
|---|---|
| `sed -i 's/foo/bar/' file.tsx` | Use the `Edit` tool |
| Hard-coding hex colors | Use design tokens from the theme |
| Importing from wrong relative path | `lib/knowledge/*.ts` imports `zwo.ts` as `"../zwo"` |
| Translating UI strings to Hebrew | All UI strings stay in English |
| Skipping quality-gate validation | Always run `validatePlan()` before returning a plan |
| Generating workouts without block structure | Use `resolveCanonicalStructure()` or build manually |

---

## Deploy

The app uses Expo — there is no `vercel deploy` for the native app itself.
A `deploy-zwift` skill exists for the **old Next.js dashboard** (`zwift-delta.vercel.app`).

For this React Native app:
- Development: `npx expo start`
- Build: `eas build` (requires EAS CLI + Expo account)
- Any backend/API routes on Vercel: push to GitHub → auto-deploy

---

## Two tools, two domains

Claude Code and Claude (Cowork) must not edit the same files simultaneously.
- Claude Code: local file edits and code changes
- Claude (Cowork): research, API calls, knowledge work
- Before any code change: check `git log` to see what changed recently
