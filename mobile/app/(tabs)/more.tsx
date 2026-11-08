import { Alert, Linking, Switch, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { NotificationsPermission } from '@/features/more/NotificationsPermission';
import { SectionsMenu } from '@/features/more/SectionsMenu';
import { WEB_URL } from '@/lib/config';
import { useAuth } from '@/stores/auth';
import { usePrefs } from '@/stores/preferences';
import { useTheme } from '@/theme/useTheme';

export default function More() {
  const { space, colors } = useTheme();
  const me = useAuth((s) => s.me);
  const signOut = useAuth((s) => s.signOut);
  const lite = usePrefs((s) => s.lite);
  const setLite = usePrefs((s) => s.setLite);
  return (
    <Screen>
      <Text variant="title">More</Text>
      <Card>
        <Text variant="heading">{me ? `${me.firstName} ${me.lastName}` : ''}</Text>
        <Text tone="muted">{me?.indexNumber ?? me?.email ?? ''}</Text>
        {me?.studentProfile ? <Text variant="small" tone="muted">{me.studentProfile.programme.name}, level {me.studentProfile.currentLevel}</Text> : null}
      </Card>
      <NotificationsPermission />
      <SectionsMenu />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="label">Lite mode</Text>
            <Text variant="small" tone="muted">Loads less on slow or expensive data: the home screen skips fees until you open them.</Text>
          </View>
          <Switch value={lite} onValueChange={setLite} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel="Lite mode" />
        </View>
      </Card>
      <Button label="Open the website" variant="secondary" onPress={() => void Linking.openURL(WEB_URL)} />
      <Button label="Sign out" variant="ghost" onPress={() => Alert.alert('Sign out?', 'Saved screens are removed from this phone. Anything you were writing stays until you sign in again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOut() }])} />
    </Screen>
  );
}
