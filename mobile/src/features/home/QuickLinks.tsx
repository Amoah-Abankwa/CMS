import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { canSee } from '@/lib/access';
import { BUILT } from '@/lib/routes';
import { SECTIONS } from '@/lib/sections';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

const SKIP = new Set(['/dashboard', '/notifications', '/account', '/activity']);

/** The screens this person can use in the app, straight from Home. Everything else is under More. */
export function QuickLinks() {
  const { colors, space } = useTheme();
  const me = useAuth((s) => s.me);
  const items = SECTIONS.flatMap((s) => s.items).filter((i) => BUILT[i.href] && !SKIP.has(i.href) && canSee(i, me)).slice(0, 10);
  if (!items.length) return <Card><Text tone="muted">Your tools are under More. They open on the website until they are added to the app.</Text></Card>;
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      {items.map((i, n) => (
        <Pressable key={i.href} accessibilityRole="link" onPress={() => router.push(BUILT[i.href] as never)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: n ? 1 : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ flex: 1 }}>{i.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
    </Card>
  );
}
