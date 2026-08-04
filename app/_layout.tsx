/**
 * Root layout — the single entry point for Expo Router.
 *
 * Responsibilities:
 *  - Initialize AsyncStorage / auth state
 *  - Decide: send to (auth) or (tabs)
 *  - Hide splash screen once ready
 *  - Register for push notifications
 */

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keep splash visible until we've checked auth state
SplashScreen.preventAutoHideAsync();

// ─── Design tokens (dark theme) ──────────────────────────────────────────────

export const COLORS = {
  bg:         '#0D0D0F',   // near-black background
  surface:    '#18181B',   // card surface
  border:     '#27272A',   // subtle borders
  text:       '#FAFAFA',   // primary text
  muted:      '#71717A',   // secondary text
  accent:     '#FF6B35',   // Zwift orange
  accentSoft: '#FF6B3520', // accent with opacity
  success:    '#22C55E',
  warning:    '#F59E0B',
  danger:     '#EF4444',
  blue:       '#3B82F6',
  purple:     '#A855F7',
} as const;

export type AppColors = typeof COLORS;

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // TODO: check for stored auth token
        // const token = await AsyncStorage.getItem('auth:token');
        // if (token) { /* validate token */ }
      } catch {
        // ignore — user will be sent to login
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!isReady) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}
