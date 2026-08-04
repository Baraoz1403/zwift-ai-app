# Deploy Reference — zwift-ai-app

This document covers how to build and deploy the React Native app and any
associated backend endpoints.

---

## Development

```bash
# Start the Expo dev server
cd "C:\Users\barak\Zwift Project\zwift-ai-app"
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

---

## Production build (EAS)

The app uses [Expo Application Services (EAS)](https://expo.dev/eas) for
production builds. Requires EAS CLI and an Expo account.

```bash
# Install EAS CLI (once)
npm install -g eas-cli

# Login (once)
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build both platforms
eas build --platform all
```

---

## Backend / API routes

Any API routes (e.g. `app/api/...` if using Expo Router server actions, or a
separate Next.js/Vercel backend) deploy on push to GitHub → Vercel auto-rebuild.

Git repo location: `C:\Users\barak\Zwift Project\zwift-ai-app`

In bash (for Claude deploy skill), the mount is at:
```bash
PROJECT=$(ls -d /sessions/*/mnt/zwift-ai-app 2>/dev/null | head -1)
```

### Commit and push

```bash
cd "$PROJECT"
git add .
git diff --cached --quiet || git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push
```

---

## Pre-deploy checks (for a future deploy skill)

Before pushing, verify:

1. TypeScript compiles: `npx tsc --noEmit`
2. Key lib files not truncated:
   - `lib/knowledge/coaching-knowledge.ts` — must contain `WORKOUT_LIBRARY_PROMPT`
   - `lib/zwo.ts` — must contain `generateZwoXml`
   - `lib/coaching/quality-gate.ts` — must contain `validatePlan`
3. No Hebrew strings in component files (UI stays English)
4. Quality gate is wired in — plan generation must call `validatePlan()` before returning

---

## Environment variables (Vercel)

Set in Vercel Dashboard → Project Settings → Environment Variables:

| Key | Description |
|---|---|
| `OPENAI_API_KEY` | GPT-4o API key |
| `KV_REST_API_URL` | Vercel KV (plan caching) |
| `KV_REST_API_TOKEN` | Vercel KV auth token |

---

## Production URL

Determined when the app is first deployed to Vercel / EAS. Update this file
when known.
