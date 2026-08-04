/**
 * Today screen — the main screen athletes see every day.
 *
 * Data flow:
 *  1. On focus → load this week's plan (GET /api/plan/:athleteId/:weekOf)
 *  2. Find today's day name → pick today's workout from plan
 *  3. Show workout with block breakdown + freshness indicators
 *  4. "Mark as Done" → FeedbackModal → POST /api/feedback (completed: true)
 *  5. "Skip today"   → POST /api/feedback (completed: false)
 *  6. If no plan → show "Go to Plan tab to generate"
 *  7. If today is rest/recovery → show rest card
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS } from '../_layout';
import { WORKOUT_CATEGORY_COLORS, FRESHNESS_LABELS, FRESHNESS_COLORS } from '../../constants/coaching';
import type { DayWorkout } from '../../lib/coaching/quality-gate';
import type { TrainingLoadSummary } from '../../lib/coaching/training-load';
import {
  loadPlan,
  submitFeedback,
  getAthleteId,
  getIcuCredentials,
  getMondayISO,
  getTodayDayName,
} from '../../lib/api/client';
import { fetchFitness } from '../../lib/api/icu';

// ─── State types ──────────────────────────────────────────────────────────────

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'no_athlete' }
  | { kind: 'no_plan' }
  | { kind: 'rest'; dayType: 'rest' | 'recovery' }
  | { kind: 'workout'; workout: DayWorkout; load: TrainingLoadSummary | null }
  | { kind: 'completed'; workout: DayWorkout }
  | { kind: 'error'; message: string };

type FeedbackRpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const loadToday = useCallback(async () => {
    try {
      setState({ kind: 'loading' });

      const athleteId = await getAthleteId();
      if (!athleteId) {
        setState({ kind: 'no_athlete' });
        return;
      }

      const weekOf = getMondayISO();
      const dayName = getTodayDayName();

      // Fetch plan + ICU load in parallel
      const icuCreds = await getIcuCredentials();
      const [planRes, fitness] = await Promise.all([
        loadPlan(athleteId, weekOf),
        icuCreds ? fetchFitness(icuCreds, icuCreds.athleteId || athleteId) : Promise.resolve(null),
      ]);

      const load: TrainingLoadSummary | null = fitness
        ? {
            ctl: fitness.ctl,
            atl: fitness.atl,
            tsb: fitness.tsb,
            freshness: fitness.tsb > 5 ? 'fresh' : fitness.tsb < -5 ? 'fatigued' : 'neutral',
            ridesLast7Days: 0,
            ridesPrior7Days: 0,
          }
        : null;

      if (!planRes.plan) {
        setState({ kind: 'no_plan' });
        return;
      }

      const workout = planRes.plan.workouts.find(w => w.day === dayName);

      if (!workout || workout.dayType === 'rest') {
        setState({ kind: 'rest', dayType: 'rest' });
        return;
      }
      if (workout.dayType === 'recovery') {
        setState({ kind: 'rest', dayType: 'recovery' });
        return;
      }

      setState({ kind: 'workout', workout, load });
    } catch (err) {
      // Web SPA mode — API routes not available; treat as no plan
      const code = (err as { code?: string })?.code;
      if (code === 'WEB_MODE') {
        setState({ kind: 'no_plan' });
        return;
      }
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load today\'s workout.',
      });
    }
  }, []);

  useFocusEffect(useCallback(() => { loadToday(); }, [loadToday]));

  async function onRefresh() {
    setRefreshing(true);
    await loadToday();
    setRefreshing(false);
  }

  async function onSkip() {
    const athleteId = await getAthleteId();
    if (!athleteId) return;
    try {
      await submitFeedback({
        athleteId,
        weekOf: getMondayISO(),
        day: getTodayDayName(),
        completed: false,
      });
      Alert.alert('Skipped', 'Session marked as skipped. Rest up!');
    } catch {
      Alert.alert('Error', 'Could not save. Try again.');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state.kind === 'loading') return <CenteredLoader />;
  if (state.kind === 'error')   return <ErrorState message={state.message} onRetry={loadToday} />;
  if (state.kind === 'no_athlete') return <NoAthleteState />;
  if (state.kind === 'no_plan')    return <NoPlanState />;
  if (state.kind === 'rest')       return <RestDayState dayType={state.dayType} />;

  const { workout, load } = state as Extract<ScreenState, { kind: 'workout' }>;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.dateLabel}>{getTodayLabel()}</Text>
        <Text style={s.screenTitle}>Today's Workout</Text>
      </View>

      {/* Load row */}
      {load && <LoadRow load={load} />}

      {/* Workout card */}
      <WorkoutHero workout={workout} />

      {/* Block breakdown */}
      <BlockBreakdown blocks={workout.blocks ?? []} />

      {/* Rationale + execution cue */}
      <CoachNotes workout={workout} />

      {/* Done button */}
      <TouchableOpacity
        style={s.doneButton}
        onPress={() => setFeedbackOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={s.doneButtonText}>✓ Mark as Done</Text>
      </TouchableOpacity>

      {/* Skip button */}
      <TouchableOpacity style={s.skipButton} onPress={onSkip} activeOpacity={0.7}>
        <Text style={s.skipButtonText}>Skip today</Text>
      </TouchableOpacity>

      {/* Feedback modal */}
      <FeedbackModal
        visible={feedbackOpen}
        workout={workout}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={async (rpe, notes) => {
          const athleteId = await getAthleteId();
          if (!athleteId) return;
          await submitFeedback({
            athleteId,
            weekOf: getMondayISO(),
            day: getTodayDayName(),
            completed: true,
            rpe,
            notes,
          });
          setFeedbackOpen(false);
          setState({ kind: 'completed', workout });
        }}
      />
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadRow({ load }: { load: TrainingLoadSummary }) {
  return (
    <View style={s.loadRow}>
      <LoadChip label="CTL" value={load.ctl} color={COLORS.blue} />
      <LoadChip label="ATL" value={load.atl} color={COLORS.warning} />
      <LoadChip label="TSB" value={load.tsb} color={load.tsb >= 0 ? COLORS.success : COLORS.danger} showSign />
      <View style={[s.freshnessChip, { backgroundColor: FRESHNESS_COLORS[load.freshness] + '20' }]}>
        <Text style={[s.freshnessText, { color: FRESHNESS_COLORS[load.freshness] }]}>
          {FRESHNESS_LABELS[load.freshness]}
        </Text>
      </View>
    </View>
  );
}

function LoadChip({
  label, value, color, showSign = false,
}: {
  label: string; value: number; color: string; showSign?: boolean;
}) {
  return (
    <View style={s.loadChip}>
      <Text style={s.loadChipLabel}>{label}</Text>
      <Text style={[s.loadChipValue, { color }]}>
        {showSign && value > 0 ? '+' : ''}{Math.round(value)}
      </Text>
    </View>
  );
}

type ExtendedWorkout = DayWorkout & {
  durationMin?: number;
  rationale?: string;
  executionCue?: string;
};

function WorkoutHero({ workout }: { workout: DayWorkout }) {
  const ext = workout as ExtendedWorkout;
  const catColor = WORKOUT_CATEGORY_COLORS[(workout.workoutType as keyof typeof WORKOUT_CATEGORY_COLORS)] ?? COLORS.accent;
  const totalMin = ext.durationMin ?? (workout.blocks ?? []).reduce((s, b) => s + b.durationMin, 0);
  return (
    <View style={[s.workoutCard, { borderLeftColor: catColor, borderLeftWidth: 4 }]}>
      <View style={s.workoutCardTop}>
        <Text style={s.workoutName}>{workout.workoutName ?? 'Workout'}</Text>
        <View style={[s.tssChip, { backgroundColor: catColor + '20' }]}>
          <Text style={[s.tssChipText, { color: catColor }]}>{workout.estimatedTSS} TSS</Text>
        </View>
      </View>
      {totalMin > 0 && <Text style={s.workoutDuration}>{totalMin} min</Text>}
    </View>
  );
}

function BlockBreakdown({ blocks }: { blocks: NonNullable<DayWorkout['blocks']> }) {
  if (!blocks || blocks.length === 0) return null;
  const total = blocks.reduce((s, b) => s + b.durationMin, 0) || 1;

  return (
    <View style={s.blockSection}>
      <Text style={s.sectionLabel}>Session Structure</Text>
      {/* Visual bar */}
      <View style={s.blockBar}>
        {blocks.map((b, i) => (
          <View
            key={i}
            style={[s.blockBarSegment, { flex: b.durationMin / total, backgroundColor: blockColor(b.type) }]}
          />
        ))}
      </View>
      {blocks.map((b, i) => {
        const raw = b as DayWorkout['blocks'] extends (infer T)[] ? T & { reps?: number } : never;
        return (
          <View key={i} style={s.blockRow}>
            <View style={[s.blockDot, { backgroundColor: blockColor(b.type) }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.blockName}>
                {blockLabel(b.type)}
                {(b as { reps?: number }).reps ? ` ×${(b as { reps?: number }).reps}` : ''}
              </Text>
              {b.powerPct !== undefined && (
                <Text style={s.blockPower}>{Math.round(b.powerPct * 100)}% FTP</Text>
              )}
            </View>
            <Text style={s.blockMin}>{b.durationMin} min</Text>
          </View>
        );
      })}
    </View>
  );
}

function CoachNotes({ workout }: { workout: DayWorkout }) {
  const ext = workout as ExtendedWorkout;
  if (!ext.rationale && !ext.executionCue) return null;
  return (
    <View style={s.coachNotes}>
      {ext.rationale && (
        <Text style={s.rationaleText}>"{ext.rationale}"</Text>
      )}
      {ext.executionCue && (
        <View style={s.cueBox}>
          <Text style={s.cueLabel}>KEY FOCUS</Text>
          <Text style={s.cueText}>{ext.executionCue}</Text>
        </View>
      )}
    </View>
  );
}

function FeedbackModal({
  visible, workout, onClose, onSubmit,
}: {
  visible: boolean;
  workout: DayWorkout;
  onClose: () => void;
  onSubmit: (rpe: FeedbackRpe, notes?: string) => Promise<void>;
}) {
  const [rpe, setRpe] = useState<FeedbackRpe | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!rpe) {
      Alert.alert('Rate the effort', 'Please select an RPE before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rpe, notes || undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>How did it go?</Text>
          <Text style={s.modalSubtitle}>{workout.workoutName}</Text>

          {/* RPE picker */}
          <Text style={s.rpeLabel}>Rate your effort (1–10)</Text>
          <View style={s.rpeRow}>
            {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as FeedbackRpe[]).map(n => (
              <TouchableOpacity
                key={n}
                style={[s.rpeBtn, rpe === n && s.rpeBtnActive]}
                onPress={() => setRpe(n)}
              >
                <Text style={[s.rpeBtnText, rpe === n && s.rpeBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notes */}
          <TextInput
            style={s.notesInput}
            placeholder="Notes (optional)"
            placeholderTextColor={COLORS.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          {/* Buttons */}
          <View style={s.modalButtons}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, !rpe && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!rpe || submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Empty / loading states ───────────────────────────────────────────────────

function CenteredLoader() {
  return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color={COLORS.accent} />
    </View>
  );
}

function NoAthleteState() {
  return (
    <View style={s.centered}>
      <Text style={s.bigEmoji}>👤</Text>
      <Text style={s.stateTitle}>Profile not set up</Text>
      <Text style={s.stateSub}>Complete onboarding to get started.</Text>
    </View>
  );
}

function NoPlanState() {
  return (
    <View style={s.centered}>
      <Text style={s.bigEmoji}>📋</Text>
      <Text style={s.stateTitle}>No plan this week</Text>
      <Text style={s.stateSub}>Go to the Plan tab and tap "Generate Plan".</Text>
    </View>
  );
}

function RestDayState({ dayType }: { dayType: 'rest' | 'recovery' }) {
  return (
    <View style={s.centered}>
      <Text style={s.bigEmoji}>{dayType === 'recovery' ? '🚴' : '🛋'}</Text>
      <Text style={s.stateTitle}>{dayType === 'recovery' ? 'Recovery Day' : 'Rest Day'}</Text>
      <Text style={s.stateSub}>
        {dayType === 'recovery'
          ? 'Easy spin only — keep power below 60% FTP.'
          : 'Today\'s job is recovery. Enjoy it.'}
      </Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={s.centered}>
      <Text style={s.bigEmoji}>⚠️</Text>
      <Text style={s.stateTitle}>{message}</Text>
      <TouchableOpacity style={s.retryButton} onPress={onRetry}>
        <Text style={s.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, gap: 12, padding: 32 },

  header: { marginBottom: 20 },
  dateLabel: { fontSize: 13, color: COLORS.muted, fontWeight: '500', marginBottom: 4 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text },

  loadRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  loadChip: { backgroundColor: COLORS.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  loadChipLabel: { fontSize: 10, fontWeight: '600', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  loadChipValue: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  freshnessChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  freshnessText: { fontSize: 13, fontWeight: '700' },

  workoutCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  workoutCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  workoutName: { fontSize: 22, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 12 },
  tssChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tssChipText: { fontSize: 13, fontWeight: '700' },
  workoutDuration: { fontSize: 14, color: COLORS.muted, fontWeight: '500' },

  blockSection: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  blockBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 16, gap: 2 },
  blockBarSegment: { borderRadius: 3 },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  blockDot: { width: 10, height: 10, borderRadius: 5 },
  blockName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  blockPower: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  blockMin: { fontSize: 14, color: COLORS.muted, fontWeight: '500' },

  coachNotes: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 16, gap: 12 },
  rationaleText: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic', lineHeight: 19 },
  cueBox: { backgroundColor: COLORS.accent + '15', borderRadius: 10, padding: 12 },
  cueLabel: { fontSize: 10, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.8, marginBottom: 4 },
  cueText: { fontSize: 14, color: COLORS.text, fontWeight: '600', lineHeight: 20 },

  doneButton: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  doneButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  skipButton: { alignItems: 'center', paddingVertical: 12 },
  skipButtonText: { fontSize: 14, color: COLORS.muted },

  bigEmoji: { fontSize: 56 },
  stateTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  stateSub: { fontSize: 15, color: COLORS.muted, textAlign: 'center' },
  retryButton: { backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  retryText: { color: COLORS.accent, fontWeight: '600' },

  // Feedback modal
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingTop: 20, gap: 16 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  modalSubtitle: { fontSize: 14, color: COLORS.muted, marginTop: -8 },
  rpeLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  rpeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rpeBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  rpeBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  rpeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  rpeBtnTextActive: { color: '#fff' },
  notesInput: { backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, color: COLORS.text, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, minHeight: 60, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: COLORS.muted, fontWeight: '600' },
  submitBtn: { flex: 2, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
