/**
 * FeedbackPrompt — post-activity feedback UI.
 *
 * Appears as a bottom sheet after the athlete taps "Mark as Done"
 * (or via push notification after ICU detects a completed activity).
 *
 * Collects:
 *  - Completed? (yes/no)
 *  - How did it feel? (much_easier → much_harder)
 *  - RPE (1–10 slider)
 *  - Free text note (optional)
 *
 * On submit: POST /api/feedback
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { COLORS } from '../app/_layout';
import { FEEL_OPTIONS, RPE_LABELS, type FeelValue } from '../constants/coaching';
import type { PostFeedbackRequest } from '../lib/api/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FeedbackPromptProps {
  visible: boolean;
  athleteId: string;
  weekOf: string;
  day: string;
  workoutName?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeedbackPrompt({
  visible, athleteId, weekOf, day, workoutName, onClose, onSubmitted,
}: FeedbackPromptProps) {
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [feel, setFeel] = useState<FeelValue | null>(null);
  const [rpe, setRpe] = useState<number>(5);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setCompleted(null);
    setFeel(null);
    setRpe(5);
    setNote('');
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (completed === null) return;
    setSubmitting(true);

    try {
      const payload: PostFeedbackRequest = {
        athleteId,
        weekOf,
        day,
        completed,
        rpe: completed ? rpe : undefined,
        feel: feel ?? undefined,
        notes: note.trim() || undefined,
      };

      // TODO: POST /api/feedback
      // await fetch('/api/feedback', { method: 'POST', body: JSON.stringify(payload) });

      await new Promise(r => setTimeout(r, 500)); // stub delay
      setSubmitted(true);
      setTimeout(() => { reset(); onClose(); onSubmitted?.(); }, 1200);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.overlayBg} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />

          {submitted ? (
            <SuccessState />
          ) : (
            <>
              <Text style={s.title}>How did it go?</Text>
              {workoutName && <Text style={s.workout}>{workoutName}</Text>}

              {/* Completed? */}
              <Text style={s.sectionLabel}>Did you complete it?</Text>
              <View style={s.yesNoRow}>
                <YesNoButton
                  label="✓ Yes, done"
                  active={completed === true}
                  onPress={() => setCompleted(true)}
                  activeColor={COLORS.success}
                />
                <YesNoButton
                  label="✗ Skipped"
                  active={completed === false}
                  onPress={() => setCompleted(false)}
                  activeColor={COLORS.danger}
                />
              </View>

              {/* How did it feel? (only if completed) */}
              {completed === true && (
                <>
                  <Text style={s.sectionLabel}>How did it feel?</Text>
                  <View style={s.feelGrid}>
                    {FEEL_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[s.feelChip, feel === opt.value && s.feelChipActive]}
                        onPress={() => setFeel(opt.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.feelEmoji}>{opt.emoji}</Text>
                        <Text style={[s.feelLabel, feel === opt.value && s.feelLabelActive]} numberOfLines={2}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* RPE */}
                  <Text style={s.sectionLabel}>Effort (RPE): {rpe}/10</Text>
                  <Text style={s.rpeDesc}>{RPE_LABELS[rpe]}</Text>
                  <View style={s.rpeRow}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <TouchableOpacity
                        key={n}
                        style={[s.rpeButton, rpe === n && s.rpeButtonActive]}
                        onPress={() => setRpe(n)}
                      >
                        <Text style={[s.rpeButtonText, rpe === n && s.rpeButtonTextActive]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Note */}
              <Text style={s.sectionLabel}>Anything to add? <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={s.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. legs felt heavy, cut last interval short..."
                placeholderTextColor={COLORS.muted}
                multiline
                maxLength={200}
              />

              {/* Submit */}
              <TouchableOpacity
                style={[s.submitButton, (completed === null || submitting) && s.submitDisabled]}
                onPress={handleSubmit}
                disabled={completed === null || submitting}
                activeOpacity={0.8}
              >
                {submitting
                  ? <ActivityIndicator color={COLORS.text} />
                  : <Text style={s.submitText}>Save feedback</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function YesNoButton({ label, active, onPress, activeColor }: { label: string; active: boolean; onPress: () => void; activeColor: string }) {
  return (
    <TouchableOpacity
      style={[s.yesNoButton, active && { backgroundColor: activeColor + '20', borderColor: activeColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.yesNoText, active && { color: activeColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SuccessState() {
  return (
    <View style={s.success}>
      <Text style={s.successEmoji}>✅</Text>
      <Text style={s.successText}>Feedback saved!</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000070' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 16, gap: 4, maxHeight: '90%' },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  workout: { fontSize: 14, color: COLORS.muted, marginBottom: 16 },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  optional: { fontWeight: '400', textTransform: 'none' },

  yesNoRow: { flexDirection: 'row', gap: 10 },
  yesNoButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
  yesNoText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },

  feelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feelChip: { width: '30%', borderRadius: 10, padding: 10, alignItems: 'center', gap: 4, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  feelChipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  feelEmoji: { fontSize: 22 },
  feelLabel: { fontSize: 11, color: COLORS.muted, textAlign: 'center', lineHeight: 14 },
  feelLabelActive: { color: COLORS.accent },

  rpeDesc: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  rpeRow: { flexDirection: 'row', gap: 4 },
  rpeButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  rpeButtonActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  rpeButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  rpeButtonTextActive: { color: COLORS.accent },

  noteInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.text, minHeight: 72, textAlignVertical: 'top' },

  submitButton: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  success: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  successEmoji: { fontSize: 48 },
  successText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
});
