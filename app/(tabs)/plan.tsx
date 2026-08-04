/**
 * Plan screen — full week view.
 *
 * Data flow:
 *  1. Week changes → loadPlan()  (GET /api/plan/:athleteId/:weekOf)
 *  2. Plan missing → show Generate button
 *  3. Generate tapped → generatePlan() (POST /api/plan/generate)
 *  4. Plan returned → display 7-day grid + TSS + phase badge
 *  5. Day tapped → DayDetail bottom sheet (blocks, rationale, execution cue)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../_layout';
import {
  DAYS_OF_WEEK,
  DAY_SHORT_LABELS,
  DAY_TYPE_COLORS,
  PHASE_LABELS,
  PHASE_COLORS,
  WORKOUT_CATEGORY_COLORS,
} from '../../constants/coaching';
import type { DayWorkout, WeeklyPlan } from '../../lib/coaching/quality-gate';
import type { TrainingPhase } from '../../lib/knowledge/periodization';
import type { DayOfWeek } from '../../constants/coaching';
import {
  loadPlan,
  generatePlan,
  getAthleteId,
  getStoredProfile,
  getIcuCredentials,
  getMondayISO,
} from '../../lib/api/client';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'generating' | 'error';

export default function PlanScreen() {
  const [monday, setMonday] = useState(() => getMondayOf(new Date()));
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [phase, setPhase] = useState<TrainingPhase>('base');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayWorkout | null>(null);

  // Load plan whenever the week changes
  const fetchPlan = useCallback(async (mondayDate: Date) => {
    setLoadState('loading');
    setPlan(null);
    setErrorMsg('');

    try {
      const athleteId = await getAthleteId();
      if (!athleteId) {
        setLoadState('idle');
        return; // Onboarding not done yet
      }

      const weekOf = isoDate(mondayDate);
      const res = await loadPlan(athleteId, weekOf);
      setPlan(res.plan);
      setLoadState('idle');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'WEB_MODE') {
        setLoadState('idle'); // No plan yet — show Generate button
        return;
      }
      setLoadState('error');
      setErrorMsg('Failed to load plan. Check your connection.');
    }
  }, []);

  useEffect(() => {
    fetchPlan(monday);
  }, [monday, fetchPlan]);

  // Generate a new plan for this week
  async function onGenerate() {
    setLoadState('generating');
    setErrorMsg('');
    try {
      const [athleteId, profile, icuCreds] = await Promise.all([
        getAthleteId(),
        getStoredProfile(),
        getIcuCredentials(),
      ]);

      if (!athleteId || !profile) {
        Alert.alert('Setup needed', 'Please complete your athlete profile first.');
        setLoadState('idle');
        return;
      }

      const weekOf = isoDate(monday);
      const result = await generatePlan({
        athleteId,
        weekOf,
        profile,
        icuApiKey: icuCreds?.apiKey,
        icuAthleteId: icuCreds?.athleteId,
      });

      setPlan(result.plan);
      setPhase(result.phase);
      setLoadState('idle');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'WEB_MODE') {
        Alert.alert(
          'Web preview only',
          'Plan generation requires the mobile app. Open on your phone via Expo Go.'
        );
        setLoadState('idle');
        return;
      }
      setLoadState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Plan generation failed.');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.screenTitle}>Training Plan</Text>
          <PhaseBadge phase={phase} />
        </View>

        {/* Week navigator */}
        <View style={s.weekNav}>
          <TouchableOpacity
            onPress={() => setMonday(addDays(monday, -7))}
            style={s.navButton}
            disabled={loadState === 'generating'}
          >
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.weekLabel}>{weekLabel(monday)}</Text>
          <TouchableOpacity
            onPress={() => setMonday(addDays(monday, 7))}
            style={s.navButton}
            disabled={loadState === 'generating'}
          >
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loadState === 'loading' && (
          <View style={s.centered}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={s.stateText}>Loading plan...</Text>
          </View>
        )}

        {/* Generating */}
        {loadState === 'generating' && (
          <View style={s.centered}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text style={s.stateText}>Generating your plan...</Text>
            <Text style={s.stateSubText}>Building block by block. This takes ~20 sec.</Text>
          </View>
        )}

        {/* Error */}
        {loadState === 'error' && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
            <TouchableOpacity onPress={() => fetchPlan(monday)} style={s.retryBtn}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No plan */}
        {loadState === 'idle' && !plan && (
          <View style={s.noPlanBox}>
            <Text style={s.noPlanEmoji}>📋</Text>
            <Text style={s.noPlanTitle}>No plan for this week</Text>
            <Text style={s.noPlanSub}>Generate a structured plan tailored to your current fitness.</Text>
            <TouchableOpacity style={s.generateButton} onPress={onGenerate} activeOpacity={0.8}>
              <Text style={s.generateButtonText}>Generate Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan display */}
        {plan && loadState !== 'loading' && (
          <>
            {/* TSS summary */}
            <View style={s.tssRow}>
              <Text style={s.tssLabel}>Weekly TSS</Text>
              <Text style={s.tssValue}>{plan.totalTSS ?? plan.workouts.reduce((s, w) => s + (w.estimatedTSS ?? 0), 0)}</Text>
            </View>

            {/* Day grid */}
            <View style={s.grid}>
              {DAYS_OF_WEEK.map((day, idx) => {
                const workout = plan.workouts.find(w => w.day === day);
                return (
                  <DayCell
                    key={day}
                    day={day}
                    dayIndex={idx}
                    workout={workout}
                    monday={monday}
                    onPress={() => workout && setSelectedDay(workout)}
                  />
                );
              })}
            </View>

            {/* Regenerate */}
            <TouchableOpacity
              style={s.regenButton}
              activeOpacity={0.8}
              onPress={onGenerate}
              disabled={loadState === 'generating'}
            >
              <Text style={s.regenText}>↺ Regenerate plan</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      {/* Day detail overlay */}
      {selectedDay && (
        <DayDetail workout={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </View>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day, dayIndex, workout, monday, onPress,
}: {
  day: DayOfWeek;
  dayIndex: number;
  workout?: DayWorkout;
  monday: Date;
  onPress: () => void;
}) {
  const date = addDays(monday, dayIndex);
  const isToday = isoDate(date) === isoDate(new Date());
  const typeColor = DAY_TYPE_COLORS[(workout?.dayType ?? 'rest') as keyof typeof DAY_TYPE_COLORS];
  const catColor = workout?.workoutType
    ? WORKOUT_CATEGORY_COLORS[workout.workoutType as keyof typeof WORKOUT_CATEGORY_COLORS]
    : undefined;

  return (
    <TouchableOpacity style={[s.dayCell, isToday && s.dayCellToday]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[s.dayName, isToday && s.dayNameToday]}>{DAY_SHORT_LABELS[day]}</Text>
      <Text style={[s.dayDate, isToday && s.dayDateToday]}>{date.getDate()}</Text>

      {workout?.dayType === 'training' && workout.workoutName ? (
        <View style={s.dayCellInner}>
          <View style={[s.dayCategoryDot, { backgroundColor: catColor ?? typeColor }]} />
          <Text style={s.dayCellWorkout} numberOfLines={2}>{workout.workoutName}</Text>
          {workout.estimatedTSS !== undefined && (
            <Text style={s.dayCellTSS}>{workout.estimatedTSS} TSS</Text>
          )}
        </View>
      ) : workout?.dayType === 'recovery' ? (
        <View style={s.dayCellInner}>
          <Text style={[s.dayCellType, { color: typeColor }]}>Recovery</Text>
        </View>
      ) : (
        <View style={s.dayCellInner}>
          <Text style={s.dayCellRest}>Rest</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Phase badge ──────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: TrainingPhase }) {
  const label = PHASE_LABELS[phase as keyof typeof PHASE_LABELS] ?? phase;
  const color = PHASE_COLORS[phase as keyof typeof PHASE_COLORS] ?? COLORS.muted;
  return (
    <View style={[s.phaseBadge, { backgroundColor: color + '20' }]}>
      <Text style={[s.phaseText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Day detail overlay ───────────────────────────────────────────────────────

type ExtendedDayWorkout = DayWorkout & {
  durationMin?: number;
  rationale?: string;
  executionCue?: string;
};

function DayDetail({ workout, onClose }: { workout: DayWorkout; onClose: () => void }) {
  const ext = workout as ExtendedDayWorkout;
  const totalMin = ext.durationMin
    ?? (workout.blocks ?? []).reduce((s, b) => s + b.durationMin, 0);

  return (
    <View style={s.overlay}>
      <TouchableOpacity style={s.overlayBg} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        <Text style={s.sheetDay}>{workout.day.charAt(0).toUpperCase() + workout.day.slice(1)}</Text>

        {workout.workoutName ? (
          <>
            <Text style={s.sheetWorkoutName}>{workout.workoutName}</Text>
            <Text style={s.sheetMeta}>
              {workout.estimatedTSS} TSS{totalMin > 0 ? ` · ${totalMin} min` : ''}
            </Text>

            {/* Block breakdown */}
            {(workout.blocks ?? []).length > 0 && (
              <View style={s.sheetBlocks}>
                {workout.blocks!.map((b, i) => (
                  <View key={i} style={s.sheetBlockRow}>
                    <View style={[s.sheetBlockDot, { backgroundColor: blockColor(b.type) }]} />
                    <Text style={s.sheetBlockLabel}>
                      {blockLabel(b.type)}{(b as { reps?: number }).reps ? ` ×${(b as { reps?: number }).reps}` : ''}{' '}
                      <Text style={s.sheetBlockPower}>
                        {b.powerPct !== undefined ? `${Math.round(b.powerPct * 100)}% FTP` : ''}
                      </Text>
                    </Text>
                    <Text style={s.sheetBlockMin}>{b.durationMin}m</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Rationale */}
            {ext.rationale && (
              <Text style={s.sheetRationale}>"{ext.rationale}"</Text>
            )}

            {/* Execution cue */}
            {ext.executionCue && (
              <View style={s.sheetCueBox}>
                <Text style={s.sheetCueLabel}>KEY FOCUS</Text>
                <Text style={s.sheetCue}>{ext.executionCue}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={s.sheetRestLabel}>
            {workout.dayType === 'recovery' ? 'Recovery day — keep it easy.' : 'Rest day — no training.'}
          </Text>
        )}

        <TouchableOpacity style={s.sheetClose} onPress={onClose}>
          <Text style={s.sheetCloseText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blockColor(type: string): string {
  const map: Record<string, string> = {
    warmup:    COLORS.warning,
    intervals: COLORS.accent,
    steady:    '#FF7043',
    cooldown:  COLORS.blue,
  };
  return map[type] ?? COLORS.muted;
}

function blockLabel(type: string): string {
  const map: Record<string, string> = {
    warmup:    'Warm-up',
    intervals: 'Intervals',
    steady:    'Steady State',
    cooldown:  'Cool-down',
  };
  return map[type] ?? type;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text },

  phaseBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  phaseText: { fontSize: 13, fontWeight: '700' },

  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  navButton: { padding: 8 },
  navArrow: { fontSize: 28, color: COLORS.muted, fontWeight: '300' },
  weekLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  centered: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  stateText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  stateSubText: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },

  errorBox: { backgroundColor: '#FF000015', borderRadius: 12, padding: 16, marginBottom: 20, gap: 10 },
  errorText: { color: COLORS.danger, fontSize: 14 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },

  noPlanBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  noPlanEmoji: { fontSize: 56 },
  noPlanTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  noPlanSub: { fontSize: 14, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 16 },
  generateButton: { marginTop: 8, backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  generateButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  tssRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  tssLabel: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  tssValue: { fontSize: 22, fontWeight: '700', color: COLORS.accent },

  grid: { gap: 8, marginBottom: 24 },

  dayCell: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dayCellToday: { borderColor: COLORS.accent },
  dayName: { fontSize: 12, fontWeight: '700', color: COLORS.muted, width: 28, textTransform: 'uppercase' },
  dayNameToday: { color: COLORS.accent },
  dayDate: { fontSize: 13, fontWeight: '600', color: COLORS.muted, width: 20, marginTop: 1 },
  dayDateToday: { color: COLORS.accent },
  dayCellInner: { flex: 1, gap: 4 },
  dayCategoryDot: { width: 8, height: 8, borderRadius: 4 },
  dayCellWorkout: { fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 20 },
  dayCellTSS: { fontSize: 12, color: COLORS.muted },
  dayCellType: { fontSize: 13, fontWeight: '600' },
  dayCellRest: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic' },

  regenButton: { backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  regenText: { color: COLORS.muted, fontWeight: '600' },

  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000080' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 16, maxHeight: '85%' },
  sheetHandle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetDay: { fontSize: 12, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  sheetWorkoutName: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  sheetMeta: { fontSize: 14, color: COLORS.muted, marginBottom: 16 },
  sheetRestLabel: { fontSize: 18, color: COLORS.muted, marginBottom: 24 },

  sheetBlocks: { gap: 2, marginBottom: 16 },
  sheetBlockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.border },
  sheetBlockDot: { width: 8, height: 8, borderRadius: 4 },
  sheetBlockLabel: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },
  sheetBlockPower: { color: COLORS.muted, fontWeight: '400' },
  sheetBlockMin: { fontSize: 12, color: COLORS.muted },

  sheetRationale: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic', marginBottom: 12, lineHeight: 19 },
  sheetCueBox: { backgroundColor: COLORS.accent + '15', borderRadius: 10, padding: 12, marginBottom: 20 },
  sheetCueLabel: { fontSize: 10, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.8, marginBottom: 4 },
  sheetCue: { fontSize: 14, color: COLORS.text, fontWeight: '600', lineHeight: 20 },

  sheetClose: { backgroundColor: COLORS.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  sheetCloseText: { color: COLORS.text, fontWeight: '600' },
});
