/**
 * Main tab navigator — shown after successful auth.
 *
 * Tabs:
 *  Today   — today's workout (default)
 *  Plan    — full week view
 *  Coach   — chat with AI coach
 */

import { Tabs } from 'expo-router';
import { COLORS } from '../_layout';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="today" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="plan" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="coach" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

// Inline placeholder icon — replace with a proper icon library (e.g. @expo/vector-icons)
function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const { View, Text } = require('react-native');
  const icons: Record<string, string> = { today: '▶', plan: '📅', coach: '💬' };
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.8, color }}>{icons[name] ?? '•'}</Text>
    </View>
  );
}
