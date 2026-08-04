/**
 * IcuWebViewLogin — Expo Go compatible version using expo-web-browser.
 *
 * Opens intervals.icu/settings in the system browser so the user can log in,
 * then shows a simple input for the API key that appears on that page.
 *
 * NOTE: In a production EAS build, this will be replaced with the full
 * embedded WebView flow that extracts the key automatically.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { fetchICUAthlete } from '../../lib/api/icu';
import { COLORS } from '../_layout';

export interface IcuLoginResult {
  apiKey: string;
  athleteId: string;
  name?: string;
}

interface Props {
  onSuccess: (result: IcuLoginResult) => void;
  onCancel: () => void;
}

export default function IcuWebViewLogin({ onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<'intro' | 'key'>('intro');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  async function openSettings() {
    await WebBrowser.openBrowserAsync('https://intervals.icu/settings#developer');
    // After browser closes, move to key entry step
    setStep('key');
  }

  async function handleConnect() {
    const key = apiKey.trim();
    if (!key) {
      Alert.alert('API Key required', 'Paste your key from the Intervals.icu settings page.');
      return;
    }
    setLoading(true);
    try {
      const athlete = await fetchICUAthlete({ apiKey: key });
      onSuccess({
        apiKey: key,
        athleteId: String(athlete.id ?? '0'),
        name: athlete.name,
      });
    } catch (err) {
      Alert.alert('Connection failed', err instanceof Error ? err.message : 'Check your API key.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Connect Intervals.icu</Text>

      {step === 'intro' && (
        <>
          <Text style={s.body}>
            Tap below to open Intervals.icu settings. Sign in if needed, then scroll down to{' '}
            <Text style={s.bold}>Developer Settings</Text> to find your API key.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={openSettings}>
            <Text style={s.primaryBtnText}>Open Intervals.icu Settings →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'key' && (
        <>
          <Text style={s.body}>
            Copy the API key from the Developer Settings section and paste it here:
          </Text>
          <TextInput
            style={s.input}
            placeholder="ic0_xxxxxxxxxxxx"
            placeholderTextColor={COLORS.muted}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[s.primaryBtn, !apiKey.trim() && s.disabled]}
            onPress={handleConnect}
            disabled={!apiKey.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>Connect →</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={() => setStep('intro')}>
            <Text style={s.cancelText}>← Back</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 28,
    justifyContent: 'center',
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  body: { fontSize: 15, color: COLORS.muted, lineHeight: 22 },
  bold: { fontWeight: '700', color: COLORS.text },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: COLORS.muted, fontSize: 14 },
});
