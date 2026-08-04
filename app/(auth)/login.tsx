/**
 * Login screen — Zwift credentials.
 *
 * Flow:
 *  1. User enters Zwift username + password
 *  2. POST /api/auth/zwift → get athleteId + token
 *  3. Store token in AsyncStorage
 *  4. Navigate to onboarding (first time) or today (returning user)
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../_layout';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your Zwift username and password.');
      return;
    }

    setLoading(true);
    try {
      // TODO: call POST /api/auth/zwift
      // const res = await fetch('/api/auth/zwift', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ username, password }),
      // });
      // const data = await res.json();
      // if (!res.ok) throw new Error(data.error);
      //
      // await AsyncStorage.multiSet([
      //   ['auth:token',    data.token],
      //   ['auth:athleteId', data.athleteId],
      //   ['auth:name',     data.name],
      //   ['auth:expiresAt', data.expiresAt],
      // ]);
      //
      // const hasProfile = await AsyncStorage.getItem(`profile:${data.athleteId}`);
      // router.replace(hasProfile ? '/(tabs)/today' : '/(auth)/onboarding');

      // Stub: go straight to onboarding for now
      await AsyncStorage.setItem('auth:token', 'stub-token');
      await AsyncStorage.setItem('auth:athleteId', 'stub-athlete');
      router.replace('/(auth)/onboarding');
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>
        {/* Logo / title */}
        <View style={s.header}>
          <Text style={s.logo}>⚡</Text>
          <Text style={s.title}>Zwift AI Coach</Text>
          <Text style={s.subtitle}>Sign in with your Zwift account</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>Username or email</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={setUsername}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={COLORS.text} />
              : <Text style={s.buttonText}>Sign in with Zwift</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={s.disclaimer}>
          Your Zwift credentials are used once to fetch your athlete data.
          They are not stored on our servers.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    marginTop: 6,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 4,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
});
