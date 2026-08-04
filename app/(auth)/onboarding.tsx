/**
 * Onboarding screen — ICU connection + athlete profile setup.
 *
 * Steps:
 *  Step 1 — Connect Intervals.icu via OAuth (user logs in on ICU's website)
 *  Step 2 — Basic profile (FTP, weight, goals, training days, experience)
 *  Step 3 — Done → navigate to /(tabs)/today
 *
 * OAuth flow:
 *  1. User presses "Connect with Intervals.icu"
 *  2. ICU login page opens in browser
 *  3. User logs in → ICU redirects back to /(auth)/icu-callback?code=...
 *  4. Callback screen exchanges code for Bearer token, saves it, then returns
 *  5. On return, this screen detects ICU connection and moves to profile step
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import IcuWebViewLogin, { type IcuLoginResult } from './icu-webview';
import { COLORS } from '../_layout';
import {
  GOAL_LABELS,
  EXPERIENCE_LABELS,
  DAYS_RANGE_LABELS,
  SESSION_LENGTH_LABELS,
  type TrainingGoal,
  type ExperienceLevel,
  type DaysRange,
  type SessionLength,
  type RiderProfile,
} from '../../lib/knowledge/rider-profile';
import {
  saveProfile,
  saveProfileLocally,
  generatePlan,
  getStoredProfile,
  getMondayISO,
  getIcuCredentials,
} from '../../lib/api/client';

// ─── ICU OAuth constants ──────────────────────────────────────────────────────

const ICU_CLIENT_ID = process.env.EXPO_PUBLIC_ICU_CLIENT_ID ?? '';

function getIcuRedirectUri(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/icu-callback`;
  }
  return 'zwiftai://auth/icu-callback';
}

function buildOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:    ICU_CLIENT_ID,
    redirect_uri: getIcuRedirectUri(),
    scope:        'ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE',
  });
  return `https://intervals.icu/oauth/authorize?${params}`;
}

// ─── Step types ───────────────────────────────────────────────────────────────

type Step = 'icu' | 'profile' | 'done';

interface ProfileForm {
  name: string;
  ftp: string;
  weightKg: string;
  goals: TrainingGoal[];
  experienceLevel: ExperienceLevel;
  daysRange: DaysRange;
  sessionLength: SessionLength;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ icuError?: string }>();
  const [step, setStep] = useState<Step>('icu');
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [showWebView, setShowWebView] = useState(false);

  const [profile, setProfile] = useState<ProfileForm>({
    name: '',
    ftp: '',
    weightKg: '',
    goals: ['fitness'],
    experienceLevel: 'intermediate',
    daysRange: '3-4',
    sessionLength: '60',
  });

  // ── Detect return from OAuth callback ──────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      // When screen regains focus (after OAuth callback redirect), check if connected
      if (step !== 'icu') return;
      getIcuCredentials().then(creds => {
        if (creds?.token || creds?.apiKey) {
          setAthleteId(creds.athleteId);
          setStep('profile');
        }
      });
    }, [step])
  );

  // Handle error passed back from callback screen
  useEffect(() => {
    if (params.icuError) {
      const msg =
        params.icuError === 'access_denied'   ? 'Access denied. Please try again.' :
        params.icuError === 'exchange_failed'  ? 'Connection failed. Please try again.' :
        params.icuError === 'no_code'          ? 'Authorization code missing.' :
        'Connection error. Please try again.';
      setOauthError(msg);
    }
  }, [params.icuError]);

  // ── Step 1: ICU login via WebView ─────────────────────────────────────────

  function handleIcuConnect() {
    setOauthError('');
    setShowWebView(true);
  }

  async function handleWebViewSuccess(result: IcuLoginResult) {
    setShowWebView(false);
    try {
      const { saveIcuCredentials, saveAthleteId } = await import('../../lib/api/client');
      await saveIcuCredentials(result.apiKey, result.athleteId);
      await saveAthleteId(result.athleteId);
      setAthleteId(result.athleteId);
      if (result.name) {
        setProfile(p => ({ ...p, name: p.name || result.name || '' }));
      }
      setStep('profile');
    } catch {
      setOauthError('Connection failed. Please try again.');
    }
  }

  // Keep API key fallback for web (WebView not available on web)
  async function handleIcuApiKey(apiKey: string) {
    setOauthError('');
    try {
      const { fetchICUAthlete } = await import('../../lib/api/icu');
      const athlete = await fetchICUAthlete(apiKey);
      const id = String(athlete.id ?? '0');
      if (athlete.name) {
        setProfile(p => ({ ...p, name: p.name || (athlete.name ?? '') }));
      }
      const { saveIcuCredentials, saveAthleteId } = await import('../../lib/api/client');
      await saveIcuCredentials(apiKey, id);
      await saveAthleteId(id);
      setAthleteId(id);
      setStep('profile');
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Connection failed. Check the API key and try again.');
      throw err;
    }
  }

  // ── Step 2: Profile ────────────────────────────────────────────────────────

  async function handleProfileSave() {
    if (!profile.name.trim()) {
      alert('Please enter your name.');
      return;
    }
    setLoading(true);
    const profileData = {
      athleteId: athleteId || '0',
      name: profile.name.trim(),
      ftp: profile.ftp ? Number(profile.ftp) : undefined,
      weightKg: profile.weightKg ? Number(profile.weightKg) : undefined,
      goals: profile.goals,
      experienceLevel: profile.experienceLevel,
      daysRange: profile.daysRange,
      sessionLength: profile.sessionLength,
      sports: ['cycling'] as string[],
    };
    try {
      // Try server save — falls back to local if API routes unavailable (web SPA mode)
      try {
        await saveProfile(profileData);
      } catch (serverErr: unknown) {
        const code = (serverErr as { code?: string })?.code;
        if (code === 'WEB_MODE') {
          // API routes not available — save locally and continue
          await saveProfileLocally(profileData as unknown as RiderProfile);
        } else {
          throw serverErr;
        }
      }

      setStep('done');

      // Generate first plan in background
      const storedProfile = await getStoredProfile();
      const creds = await getIcuCredentials();
      if (storedProfile && creds) {
        generatePlan({
          athleteId: athleteId || '0',
          weekOf: getMondayISO(),
          profile: storedProfile,
          icuApiKey: creds.apiKey,
          icuAthleteId: creds.athleteId,
        }).catch(() => {});
      }

      setTimeout(() => router.replace('/(tabs)/today'), 1500);
    } catch {
      alert('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <StepIndicator current={step} />

      {step === 'icu' && (
        <IcuStep
          onConnect={handleIcuConnect}
          onApiKey={handleIcuApiKey}
          error={oauthError}
          isWeb={typeof window !== 'undefined'}
        />
      )}

      {/* WebView login modal (native only) */}
      <Modal visible={showWebView} animationType="slide" presentationStyle="fullScreen">
        <IcuWebViewLogin
          onSuccess={handleWebViewSuccess}
          onCancel={() => setShowWebView(false)}
        />
      </Modal>

      {step === 'profile' && (
        <ProfileStep
          form={profile}
          onChange={setProfile}
          onSave={handleProfileSave}
          loading={loading}
        />
      )}

      {step === 'done' && (
        <View style={s.doneContainer}>
          <Text style={s.doneEmoji}>🏁</Text>
          <Text style={s.doneTitle}>All set!</Text>
          <Text style={s.doneSub}>Generating your first training plan...</Text>
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />
        </View>
      )}
    </ScrollView>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['icu', 'profile', 'done'];
  const labels = ['Connect ICU', 'Your Profile', 'Done'];
  const idx = steps.indexOf(current);
  return (
    <View style={s.stepRow}>
      {steps.map((s_, i) => (
        <View key={s_} style={s.stepItem}>
          <View style={[s.stepDot, i <= idx && s.stepDotActive]}>
            <Text style={[s.stepNum, i <= idx && s.stepNumActive]}>{i + 1}</Text>
          </View>
          <Text style={[s.stepLabel, i === idx && s.stepLabelActive]}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Step 1: ICU connect ─────────────────────────────────────────────────────

function IcuStep({
  onConnect,
  onApiKey,
  error,
  isWeb,
}: {
  onConnect: () => void;
  onApiKey: (key: string) => void;
  error: string;
  isWeb: boolean;
}) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleApiKeyConnect() {
    if (!apiKey.trim()) return;
    setLoading(true);
    try { await onApiKey(apiKey.trim()); } finally { setLoading(false); }
  }

  function openIcuSettings() {
    if (typeof window !== 'undefined') window.open('https://intervals.icu/settings', '_blank');
  }

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Connect Intervals.icu</Text>
      <Text style={s.stepDesc}>
        Your Intervals.icu account provides the fitness data (CTL, ATL, TSB)
        the AI uses to build your plan.
      </Text>

      <View style={s.icuCard}>
        {!isWeb ? (
          // ── Native: WebView login — user enters email+password ──────────────
          <>
            <Text style={s.icuCardTitle}>Log in with your Intervals.icu account</Text>
            <Text style={s.icuCardDesc}>
              Sign in with your email and password — the app connects automatically.
              No API keys or developer settings needed.
            </Text>
            <TouchableOpacity style={s.connectButton} onPress={onConnect} activeOpacity={0.8}>
              <Text style={s.connectButtonText}>Connect with Intervals.icu →</Text>
            </TouchableOpacity>
          </>
        ) : (
          // ── Web fallback: API key (3-step) ──────────────────────────────────
          <>
            <Text style={s.icuCardTitle}>Connect with your API Key</Text>
            <View style={s.step}>
              <View style={s.stepBadge}><Text style={s.stepBadgeText}>1</Text></View>
              <View style={s.stepBody}>
                <Text style={s.stepBodyText}>Open your Intervals.icu settings</Text>
                <TouchableOpacity style={s.openButton} onPress={openIcuSettings} activeOpacity={0.8}>
                  <Text style={s.openButtonText}>Open intervals.icu/settings ↗</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.step}>
              <View style={s.stepBadge}><Text style={s.stepBadgeText}>2</Text></View>
              <View style={s.stepBody}>
                <Text style={s.stepBodyText}>
                  Scroll to <Text style={s.bold}>Developer Settings</Text> → copy the API Key
                </Text>
              </View>
            </View>
            <View style={s.step}>
              <View style={s.stepBadge}><Text style={s.stepBadgeText}>3</Text></View>
              <View style={s.stepBody}>
                <Text style={s.stepBodyText}>Paste it here:</Text>
                <TextInput
                  style={s.input}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Paste API Key"
                  placeholderTextColor={COLORS.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[s.connectButton, (!apiKey.trim() || loading) && s.buttonDisabled]}
              onPress={handleApiKeyConnect}
              disabled={!apiKey.trim() || loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={COLORS.text} /> : <Text style={s.connectButtonText}>Connect →</Text>}
            </TouchableOpacity>
          </>
        )}
        {!!error && <Text style={s.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

// ─── Step 2: Profile ──────────────────────────────────────────────────────────

function ProfileStep({
  form, onChange, onSave, loading,
}: {
  form: ProfileForm;
  onChange: (f: ProfileForm) => void;
  onSave: () => void;
  loading: boolean;
}) {
  function toggleGoal(goal: TrainingGoal) {
    const has = form.goals.includes(goal);
    onChange({
      ...form,
      goals: has ? form.goals.filter(g => g !== goal) : [...form.goals, goal],
    });
  }

  return (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Your Profile</Text>

      <Field label="Your name">
        <TextInput
          style={s.input}
          value={form.name}
          onChangeText={v => onChange({ ...form, name: v })}
          placeholder="e.g. Barak"
          placeholderTextColor={COLORS.muted}
          autoCorrect={false}
        />
      </Field>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field label="FTP (watts)" hint="Leave blank if unknown">
            <TextInput
              style={s.input}
              value={form.ftp}
              onChangeText={v => onChange({ ...form, ftp: v })}
              placeholder="250"
              placeholderTextColor={COLORS.muted}
              keyboardType="numeric"
            />
          </Field>
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Field label="Weight (kg)">
            <TextInput
              style={s.input}
              value={form.weightKg}
              onChangeText={v => onChange({ ...form, weightKg: v })}
              placeholder="70"
              placeholderTextColor={COLORS.muted}
              keyboardType="numeric"
            />
          </Field>
        </View>
      </View>

      <Field label="Goals (select all that apply)">
        <ChipGroup
          options={Object.entries(GOAL_LABELS) as [TrainingGoal, string][]}
          selected={form.goals}
          onToggle={toggleGoal}
          multi
        />
      </Field>

      <Field label="Experience level">
        <ChipGroup
          options={Object.entries(EXPERIENCE_LABELS) as [ExperienceLevel, string][]}
          selected={[form.experienceLevel]}
          onToggle={v => onChange({ ...form, experienceLevel: v as ExperienceLevel })}
        />
      </Field>

      <Field label="Training days per week">
        <ChipGroup
          options={Object.entries(DAYS_RANGE_LABELS) as [DaysRange, string][]}
          selected={[form.daysRange]}
          onToggle={v => onChange({ ...form, daysRange: v as DaysRange })}
        />
      </Field>

      <Field label="Session length">
        <ChipGroup
          options={Object.entries(SESSION_LENGTH_LABELS) as [SessionLength, string][]}
          selected={[form.sessionLength]}
          onToggle={v => onChange({ ...form, sessionLength: v as SessionLength })}
        />
      </Field>

      <PrimaryButton onPress={onSave} loading={loading} label="Generate my first plan →" />
    </View>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {hint && <Text style={s.fieldHint}>{hint}</Text>}
      {children}
    </View>
  );
}

function ChipGroup<T extends string>({
  options, selected, onToggle, multi = false,
}: {
  options: [T, string][];
  selected: T[];
  onToggle: (v: T) => void;
  multi?: boolean;
}) {
  return (
    <View style={s.chipRow}>
      {options.map(([value, label]) => {
        const active = selected.includes(value);
        return (
          <TouchableOpacity
            key={value}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onToggle(value)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PrimaryButton({ onPress, loading, label }: { onPress: () => void; loading: boolean; label: string }) {
  return (
    <TouchableOpacity
      style={[s.button, loading && s.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={COLORS.text} />
        : <Text style={s.buttonText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },

  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 40 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  stepNum: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  stepNumActive: { color: COLORS.text },
  stepLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '500' },
  stepLabelActive: { color: COLORS.text },

  stepContent: { gap: 4 },
  stepTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  stepDesc: { fontSize: 15, color: COLORS.muted, lineHeight: 22, marginBottom: 24 },

  icuCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    gap: 12,
  },
  icuCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  icuCardDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  connectButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  connectButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  errorText: { fontSize: 13, color: '#ff6b6b', marginTop: 4 },

  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldHint: { fontSize: 12, color: COLORS.muted, marginBottom: 8, opacity: 0.7 },

  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.text },

  row: { flexDirection: 'row' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  chipTextActive: { color: COLORS.accent, fontWeight: '600' },

  button: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // Step-by-step instructions (API key fallback)
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  stepBody: { flex: 1, gap: 8 },
  stepBodyText: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  bold: { fontWeight: '700', color: COLORS.text },
  openButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  openButtonText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },

  doneContainer: { alignItems: 'center', paddingTop: 60 },
  doneEmoji: { fontSize: 64, marginBottom: 20 },
  doneTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  doneSub: { fontSize: 16, color: COLORS.muted, marginTop: 8 },
});
