/**
 * Admin screen — coach view (Barak only).
 *
 * Protected: only ADMIN_ZWIFT_ID can access.
 *
 * Shows:
 *  - All athletes: name, CTL, TSB, freshness, phase, plan status
 *  - Tap athlete → view their full week plan + feedback history
 *  - Ability to regenerate or manually edit their plan
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { COLORS } from '../_layout';
import {
  PHASE_LABELS,
  PHASE_COLORS,
  FRESHNESS_LABELS,
  FRESHNESS_COLORS,
} from '../../constants/coaching';
import type { AthleteOverview } from '../../lib/api/types';
import type { TrainingPhase } from '../../lib/knowledge/periodization';

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminAthletesScreen() {
  const [athletes, setAthletes] = useState<AthleteOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AthleteOverview | null>(null);

  async function loadAthletes() {
    try {
      // TODO: fetch /api/admin/athletes with admin token
      // const res = await fetch('/api/admin/athletes', { headers: { Authorization: `Bearer ${adminToken}` } });
      // const data = await res.json();
      // setAthletes(data.athletes);

      // Stub data
      setAthletes([
        {
          athleteId: 'barak',
          name: 'Barak',
          ctl: 68,
          tsb: 4,
          currentPhase: 'build',
          thisWeekPlan: null,
          lastFeedbackAt: new Date().toISOString(),
          lastFeedbackNote: 'Felt strong on the 4×4, could have pushed harder',
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAthletes(); }, []);

  function onRefresh() {
    setRefreshing(true);
    loadAthletes();
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.screenTitle}>Athletes</Text>
        <Text style={s.count}>{athletes.length} active</Text>
      </View>

      <FlatList
        data={athletes}
        keyExtractor={a => a.athleteId}
        renderItem={({ item }) => (
          <AthleteCard athlete={item} onPress={() => setSelected(item)} />
        )}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        ListEmptyComponent={<EmptyState />}
      />

      {selected && (
        <AthleteDetail athlete={selected} onClose={() => setSelected(null)} />
      )}
    </View>
  );
}

// ─── Athlete card ─────────────────────────────────────────────────────────────

function AthleteCard({ athlete, onPress }: { athlete: AthleteOverview; onPress: () => void }) {
  const freshness = athlete.tsb > 5 ? 'fresh' : athlete.tsb < -5 ? 'fatigued' : 'neutral';
  const phaseColor = PHASE_COLORS[athlete.currentPhase as TrainingPhase];

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      {/* Name row */}
      <View style={s.cardHeader}>
        <Text style={s.athleteName}>{athlete.name}</Text>
        <View style={[s.phasePill, { backgroundColor: phaseColor + '20' }]}>
          <Text style={[s.phaseText, { color: phaseColor }]}>
            {PHASE_LABELS[athlete.currentPhase as TrainingPhase]}
          </Text>
        </View>
      </View>

      {/* Load stats */}
      <View style={s.statsRow}>
        <Stat label="CTL" value={athlete.ctl} color={COLORS.blue} />
        <Stat label="TSB" value={athlete.tsb} color={FRESHNESS_COLORS[freshness]} showSign />
        <View style={[s.freshnessPill, { backgroundColor: FRESHNESS_COLORS[freshness] + '20' }]}>
          <Text style={[s.freshnessText, { color: FRESHNESS_COLORS[freshness] }]}>
            {FRESHNESS_LABELS[freshness]}
          </Text>
        </View>
      </View>

      {/* Last feedback */}
      {athlete.lastFeedbackNote && (
        <Text style={s.feedbackNote} numberOfLines={1}>
          💬 "{athlete.lastFeedbackNote}"
        </Text>
      )}

      {/* Plan status */}
      <Text style={[s.planStatus, athlete.thisWeekPlan ? s.planOk : s.planMissing]}>
        {athlete.thisWeekPlan ? '✓ Plan generated' : '⚠ No plan this week'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Athlete detail overlay ───────────────────────────────────────────────────

function AthleteDetail({ athlete, onClose }: { athlete: AthleteOverview; onClose: () => void }) {
  return (
    <View style={s.overlay}>
      <TouchableOpacity style={s.overlayBg} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        <Text style={s.sheetName}>{athlete.name}</Text>

        <View style={s.sheetActions}>
          <ActionButton label="↺ Regenerate plan" onPress={() => { /* TODO */ }} />
          <ActionButton label="✏ Edit plan" onPress={() => { /* TODO */ }} secondary />
        </View>

        {/* TODO: show full week plan inline */}
        <Text style={s.sheetTodo}>Full week plan + feedback history coming soon.</Text>

        <TouchableOpacity style={s.sheetClose} onPress={onClose}>
          <Text style={s.sheetCloseText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, color, showSign = false }: { label: string; value: number; color: string; showSign?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>
        {showSign && value > 0 ? '+' : ''}{Math.round(value)}
      </Text>
    </View>
  );
}

function ActionButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <TouchableOpacity
      style={[s.actionButton, secondary && s.actionButtonSecondary]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.actionButtonText, secondary && s.actionButtonTextSecondary]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyEmoji}>👤</Text>
      <Text style={s.emptyText}>No athletes yet.</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  screenTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  count: { fontSize: 14, color: COLORS.muted },

  list: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },

  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  athleteName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  phasePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  phaseText: { fontSize: 12, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stat: { gap: 2 },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontWeight: '700' },
  freshnessPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  freshnessText: { fontSize: 12, fontWeight: '700' },

  feedbackNote: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic' },
  planStatus: { fontSize: 12, fontWeight: '600' },
  planOk: { color: COLORS.success },
  planMissing: { color: COLORS.warning },

  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000080' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingTop: 16 },
  sheetHandle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetName: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  sheetActions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionButton: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actionButtonSecondary: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  actionButtonText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  actionButtonTextSecondary: { color: COLORS.muted },
  sheetTodo: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginBottom: 20 },
  sheetClose: { backgroundColor: COLORS.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sheetCloseText: { color: COLORS.text, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: COLORS.muted },
});
