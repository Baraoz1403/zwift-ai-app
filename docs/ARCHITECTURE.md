# Zwift AI App — Architecture
Version 0.1 · July 2026

---

## Tech Stack

- **Framework**: React Native + Expo (TypeScript)
- **Navigation**: Expo Router (file-based)
- **Notifications**: expo-notifications
- **Storage**: AsyncStorage (local) + backend API (server)
- **Backend**: Next.js API routes on Vercel (shared with existing project or new)
- **AI**: OpenAI API (GPT-4o)
- **DB/Cache**: Vercel KV (Redis)

---

## Folder Structure

```
zwift-ai-app/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx          # Zwift login
│   │   └── onboarding.tsx     # ICU connect + profile
│   ├── (tabs)/
│   │   ├── today.tsx          # Today's workout (main screen)
│   │   ├── plan.tsx           # Full week plan
│   │   └── coach.tsx          # Chat with AI coach
│   └── admin/
│       └── athletes.tsx       # Coach view (Barak only)
├── components/
│   ├── WorkoutCard.tsx        # Single workout display
│   ├── FeedbackPrompt.tsx     # Post-activity feedback UI
│   ├── PlanWeekView.tsx       # Weekly plan grid
│   └── ChatBubble.tsx         # Coach chat UI
├── lib/
│   ├── api/
│   │   ├── zwift.ts           # Zwift auth + activity fetch
│   │   └── icu.ts             # ICU auth + workout upload
│   ├── coaching/
│   │   ├── engine.ts          # Plan generation (calls AI)
│   │   ├── quality-gate.ts    # Validates every plan before use
│   │   └── prompt-builder.ts  # Builds AI prompt from knowledge + profile
│   └── knowledge/
│       ├── rules.ts           # Coaching rules (structured constants)
│       ├── zones.ts           # Power zones + pace zones
│       └── periodization.ts   # Phase logic (base/build/taper/race)
├── docs/
│   ├── SPEC.md
│   └── ARCHITECTURE.md        ← this file
└── constants/
    └── coaching.ts            # Workout types, forbidden patterns
```

---

## Key Principles

### Knowledge lives in code, not in AI memory
All coaching rules are TypeScript constants in `lib/knowledge/`.
The AI prompt is BUILT from these constants — not written as free text.
If a rule changes, it changes in one place.

### Quality gate is code, not prompt
`lib/coaching/quality-gate.ts` validates every generated plan.
A plan that fails is rejected. The AI retries with a diagnostic message.
This is enforced before any plan reaches the athlete.

### Connection code is isolated
`lib/api/zwift.ts` and `lib/api/icu.ts` contain only connection logic.
No business logic. No UI. Easily testable.

---

## Data Flow

```
Athlete opens app
    → fetch profile from AsyncStorage
    → fetch plan from server (GET /api/plan/:athleteId/:weekOf)
    → if no plan: trigger generation (POST /api/plan/generate)
    → display today's workout

Athlete finishes activity
    → Zwift/ICU webhook OR polling detects completion
    → push notification sent
    → athlete opens FeedbackPrompt
    → feedback saved to server (POST /api/feedback)
    → AI updates plan if needed

Coach opens admin
    → fetch all athletes (GET /api/admin/athletes)
    → view plans, feedback, history
    → edit plan (PATCH /api/plan/:athleteId/:weekOf)
```

---

## Quality Gate Rules (enforced in code)

```typescript
// Every training day must pass ALL of these:
const QUALITY_RULES = {
  minIntervalBlocks: 3,           // at least 3 interval blocks
  forbiddenWorkoutTypes: [        // reject if plan contains:
    'Foundation Ride',
    'Free Ride',
    'Z2 Endurance',               // as standalone workout
  ],
  requiredStructure: ['warmup', 'intervals', 'cooldown'],
  weeklyTSSRange: { min: 0.7, max: 1.3 }, // × athlete's typical TSS
};
```

---

## Notification Strategy

Post-activity detection:
1. Poll ICU every 15 minutes for new activities (background task)
2. On new activity detected → schedule local push notification
3. Notification opens FeedbackPrompt screen

---

## Admin Access Control

Admin route (`/admin/*`) is protected:
- Reads Zwift athlete ID from auth
- Compares to `ADMIN_ZWIFT_ID` environment variable (Barak's ID)
- Returns 403 for all others
