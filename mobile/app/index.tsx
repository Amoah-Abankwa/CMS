import { Redirect } from 'expo-router';
import { useAuth } from '@/stores/auth';
import { usePrefs } from '@/stores/preferences';

/** Where to start: onboarding the first time, then sign-in, then the app. */
export default function Start() {
  const onboarded = usePrefs((s) => s.onboarded);
  const status = useAuth((s) => s.status);
  if (status === 'unknown') return null;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href={status === 'signed_in' ? '/(tabs)' : '/sign-in'} />;
}
