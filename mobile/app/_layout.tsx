import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setSessionExpiredHandler } from '@/lib/api';
import { OfflineBanner } from '@/components/states/OfflineBanner';
import { useAuth } from '@/stores/auth';
import { useNetwork } from '@/stores/network';
import { useTheme } from '@/theme/useTheme';

// The one splash screen (app.json, same image on iOS and Android) stays up until we know who is signed in.
void SplashScreen.preventAutoHideAsync();

/**
 * When the session really expires: drafts are already saved on the phone as people type, so nothing is
 * lost; sign out, and the sign-in screen says why and that their work is kept.
 */
setSessionExpiredHandler(async () => {
  if (useAuth.getState().status !== 'signed_in') return;
  await useAuth.getState().signOut('expired');
  router.replace('/sign-in');
});

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const hydrate = useAuth((s) => s.hydrate);
  const start = useNetwork((s) => s.start);
  const { colors, scheme } = useTheme();

  useEffect(() => start(), [start]);
  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => { if (status !== 'unknown') void SplashScreen.hideAsync(); }, [status]);

  // The navigator is always mounted; the splash screen covers it until the start screen can decide.
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </View>
    </SafeAreaProvider>
  );
}
