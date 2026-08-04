/**
 * ICU OAuth callback screen.
 *
 * This screen is opened after the user logs in to Intervals.icu.
 * It reads the `code` from the URL, exchanges it for a Bearer token
 * via our server endpoint, then saves credentials and proceeds to onboarding.
 *
 * Deep link (native): zwiftai://auth/icu-callback?code=...
 * Web redirect URL:   http://localhost:8082/auth/icu-callback?code=...
 */

import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../_layout';
import { saveIcuToken } from '../../lib/api/client';
import { apiBase } from '../../lib/api/client-internal';

export default function IcuCallbackScreen() {
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    if (error) {
      router.replace({ pathname: '/(auth)/onboarding', params: { icuError: error } });
      return;
    }

    if (!code) {
      router.replace({ pathname: '/(auth)/onboarding', params: { icuError: 'no_code' } });
      return;
    }

    exchangeCode(code).catch(() => {
      router.replace({ pathname: '/(auth)/onboarding', params: { icuError: 'exchange_failed' } });
    });
  }, [code, error]);

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={s.label}>Connecting to Intervals.icu…</Text>
    </View>
  );
}

async function exchangeCode(code: string) {
  const redirectUri = getRedirectUri();
  const base = apiBase();

  const res = await fetch(`${base}/api/auth/icu/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Token exchange failed');
  }

  const data = await res.json() as {
    access_token: string;
    athlete?: { id?: string; name?: string };
  };

  const athleteId = String(data.athlete?.id ?? '0');
  await saveIcuToken(data.access_token, athleteId);
}

function getRedirectUri(): string {
  if (typeof window !== 'undefined') {
    // Web: use the current origin + callback path
    return `${window.location.origin}/auth/icu-callback`;
  }
  // Native: custom scheme
  return 'zwiftai://auth/icu-callback';
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  label: {
    fontSize: 16,
    color: COLORS.muted,
  },
});
