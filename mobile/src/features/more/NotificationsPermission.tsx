import { useEffect, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Notice } from '@/components/states/Notice';
import { PermissionPrompt } from '@/components/states/PermissionPrompt';
import { SuccessState } from '@/components/states/SuccessState';

type State = 'unknown' | 'granted' | 'ask' | 'blocked' | 'dismissed';

/**
 * Expo Go no longer includes notifications (since SDK 53), and even loading the module there prints
 * warnings. So it is loaded only in a real build of the app; Expo Go shows a short note instead.
 */
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const notifications = (): typeof import('expo-notifications') => require('expo-notifications');

/** Notifications need permission: say why, allow a way back (Not now), and send to Settings if refused before. */
export function NotificationsPermission() {
  const [state, setState] = useState<State>('unknown');
  const [justAllowed, setJustAllowed] = useState(false);
  useEffect(() => {
    if (inExpoGo) return;
    void notifications().getPermissionsAsync().then((p) => setState(p.granted ? 'granted' : p.canAskAgain ? 'ask' : 'blocked')).catch(() => undefined);
  }, []);
  if (inExpoGo) return <Notice tone="info" title="Notifications">They work in the installed ANU app. Expo Go, used while testing, cannot show them.</Notice>;
  if (justAllowed) return <SuccessState title="Notifications are on" reassurance="We only send things that need you: results, fees due, registration decisions and messages from your offices." next="You can turn them off any time in your phone's Settings." />;
  if (state === 'unknown' || state === 'granted' || state === 'dismissed') return null;
  return (
    <PermissionPrompt
      title="Get notified when something needs you"
      why="So we can tell you when results are published, when fees are due and when your registration is approved, even when the app is closed. Nothing else."
      blocked={state === 'blocked'}
      onAllow={() => void notifications().requestPermissionsAsync().then((p) => (p.granted ? setJustAllowed(true) : setState(p.canAskAgain ? 'dismissed' : 'blocked')))}
      onNotNow={() => setState('dismissed')}
    />
  );
}
