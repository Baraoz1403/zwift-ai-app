# Zwift AI App — Product Specification
Version 0.5 · Approved · July 2026

---

## Vision

An AI coach for cycling and running.
Knows each athlete deeply, plans professional workouts, uploads them directly to Zwift.
The athlete opens the app and finds a workout waiting — personalized, justified, based on their latest data.

---

## Users

- Barak + friends. Personal, not commercial.
- Two roles: Athlete and Coach (admin).

## Interface Priority

1. Mobile phone — super UI, clean and professional
2. iPad
3. Desktop (last)

---

## Onboarding — New Athlete

1. Login with Zwift credentials
2. Login with Intervals.icu credentials — system fetches API key automatically
3. Fill basic profile (FTP, weight, goals, training days, experience level)
4. System pulls data from Zwift + ICU → generates first plan

---

## Athlete Profile

- Name, FTP (cycling), Threshold Pace (running), weight
- Goals: weight loss / FTP improvement / general fitness / fun
- Training days per week (1–6)
- Experience level: beginner / intermediate / advanced

---

## Fitness Data (pulled automatically)

From Zwift: ride history, recent activities
From ICU: CTL, ATL, TSB, activity history

---

## Core Flow

```
Profile + Zwift/ICU data + feedback
        ↓
AI generates weekly plan
        ↓
Quality gate (code — not promises)
        ↓
Upload to ICU
        ↓
Auto-sync to Zwift
        ↓
Athlete rides/runs
        ↓
Post-activity reminder → feedback
        ↓
Coach updates plan
```

---

## Workout Upload

- Cycling workouts → ICU with type: Zwift RIDE
- Running workouts → ICU with type: Zwift RUN

---

## Weekly Plan

- Auto-generated for the full week
- Coach (AI) updates based on athlete feedback
- Auto-uploaded to ICU

---

## What Is a Professional Workout

Every workout = warmup + intervals + cooldown.
Exact watt values (% of FTP for cycling, pace zones for running).
Physiologically descriptive name.

### Forbidden
- Unstructured rides (Foundation Ride, free ride)
- Z2 as a standalone workout
- Workouts without structure blocks
- Generic templates with changed values

### Quality Gate (enforced in code)
- Every training day (non-Recovery) must have ≥3 interval blocks
- Foundation Ride on a training day = reject and retry
- Z2 as standalone = reject and retry
- Weekly TSS must be within reasonable range for athlete's CTL+TSB

---

## Post-Activity Feedback Loop

System detects activity completion → sends push notification to phone.
Athlete gets a short, friendly prompt — responds in seconds.
Feedback enters coach memory → influences next plan.

---

## Athlete–Coach Communication

- Free chat (athlete asks, coach responds)
- Post-activity questionnaire
- Both feed into plan updates

---

## Coach Admin Dashboard

- Login: Barak's Zwift credentials only
- View all athletes: name, CTL, TSB, this week's plan, last feedback
- Update any athlete's plan
- View communication history per athlete

---

## Integrations

| Service | What | How |
|---|---|---|
| Intervals.icu | Upload workouts, read CTL/ATL/TSB | Personal API key (fetched automatically) |
| Zwift | Receive workouts via ICU sync | Auto-sync |
| Zwift API | Read ride history | Bearer token |

---

## Out of Scope (v1)

- No payment / subscription
- No TrainingPeaks
- No fancy dashboard UI for athletes (focus: workout delivery)
