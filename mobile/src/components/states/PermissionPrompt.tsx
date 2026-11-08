import { Linking, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';

/**
 * Asking for a phone permission: explain why it is needed, and always give a way back. If it was
 * refused before, the phone will not ask again, so send them to Settings instead.
 */
export function PermissionPrompt({ title, why, blocked, onAllow, onNotNow }: { title: string; why: string; blocked: boolean; onAllow: () => void; onNotNow: () => void }) {
  const { space } = useTheme();
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      <Text tone="muted">{why}</Text>
      {blocked ? <Text variant="small">You turned this off earlier. You can turn it on in your phone’s Settings, then come back.</Text> : null}
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        {blocked ? <Button label="Open Settings" onPress={() => void Linking.openSettings()} /> : <Button label="Allow" onPress={onAllow} />}
        <Button label="Not now" variant="ghost" onPress={onNotNow} />
      </View>
    </Card>
  );
}
