import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { notificationsApi, type NotificationPage } from '@/api/notifications';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { WEB_URL } from '@/lib/config';
import { appRoute } from '@/lib/routes';
import { useTheme } from '@/theme/useTheme';

const ago = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Notifications() {
  const { colors, space, radius } = useTheme();
  const q = useQuery<NotificationPage>('me.notifications', '/notifications', { page: 1, pageSize: 50 });
  const open = async (id: string, link: string | null) => {
    await notificationsApi.markRead(id).catch(() => undefined);
    const inApp = appRoute(link);
    if (inApp) router.push(inApp as never);
    else if (link) void Linking.openURL(`${WEB_URL}${link}`);
    q.refresh();
  };
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Notifications" />
      <QueryView q={q} skeleton={<SkeletonList rows={6} />}>
        {(d) => d.items.length === 0 ? (
          <EmptyState title="No notifications" why="Messages about results, fees, registration and your offices appear here as they happen." />
        ) : (
          <View style={{ gap: space.sm }}>
            {d.unread ? <Button label={`Mark all ${d.unread} as read`} variant="ghost" onPress={() => void notificationsApi.markAllRead().then(q.refresh)} /> : null}
            {d.items.map((n) => (
              <Pressable key={n.id} accessibilityRole="button" onPress={() => void open(n.id, n.link)} style={{ backgroundColor: n.readAt ? colors.surface : colors.primarySoft, borderRadius: radius.md, padding: space.md, gap: 2 }}>
                <Text variant="label">{n.title}</Text>
                <Text variant="small">{n.body}</Text>
                <Text variant="small" tone="muted">{ago(n.createdAt)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
