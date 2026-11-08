import type { ComponentProps } from 'react';
import { Redirect, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/theme/useTheme';

type Icon = ComponentProps<typeof Ionicons>['name'];
const icon = (name: Icon) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const status = useAuth((s) => s.status);
  const student = useAuth((s) => s.me?.type === 'STUDENT');
  const { colors } = useTheme();
  if (status !== 'signed_in') return <Redirect href="/sign-in" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: icon('book-outline'), href: student ? undefined : null }} />
      <Tabs.Screen name="fees" options={{ title: 'Fees', tabBarIcon: icon('wallet-outline'), href: student ? undefined : null }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis-horizontal') }} />
    </Tabs>
  );
}
