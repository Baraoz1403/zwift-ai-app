import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [target, setTarget] = useState<'loading' | 'onboarding' | 'tabs'>('loading');

  useEffect(() => {
    AsyncStorage.getItem('auth:athleteId').then(id => {
      setTarget(id ? 'tabs' : 'onboarding');
    });
  }, []);

  if (target === 'loading') return null;
  if (target === 'tabs') return <Redirect href="/(tabs)/today" />;
  return <Redirect href="/(auth)/onboarding" />;
}
