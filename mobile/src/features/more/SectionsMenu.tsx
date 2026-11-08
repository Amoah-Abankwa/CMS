import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { canSee } from '@/lib/access';
import { WEB_URL } from '@/lib/config';
import { BUILT } from '@/lib/routes';
import { SECTIONS } from '@/lib/sections';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

/**
 * Everything the website offers this person, in the website's own sections and with the same
 * permissions. Built screens open in the app; the rest open on the website until they are built.
 */
export function SectionsMenu() {
  const { colors, space } = useTheme();
  const me = useAuth((s) => s.me);
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => canSee(i, me)) })).filter((s) => s.items.length);
  return (
    <View style={{ gap: space.lg }}>
      {sections.map((s) => (
        <View key={s.label} style={{ gap: space.sm }}>
          <Text variant="label" tone="muted">{s.label}</Text>
          <Card style={{ padding: 0, gap: 0 }}>
            {s.items.map((i, n) => {
              const inApp = BUILT[i.href];
              return (
                <Pressable key={i.href} accessibilityRole="link" accessibilityHint={inApp ? undefined : 'Opens on the website'} onPress={() => (inApp ? router.push(inApp as never) : void Linking.openURL(`${WEB_URL}${i.href}`))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, borderTopWidth: n ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ flex: 1 }}>{i.label}</Text>
                  {inApp ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : <Text variant="small" tone="muted">Website</Text>}
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}
