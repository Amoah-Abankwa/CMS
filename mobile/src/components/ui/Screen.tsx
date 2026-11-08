import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

/** A page: safe-area padding, the page colour, and optional pull to refresh. */
export function Screen({ children, scroll = true, refreshing, onRefresh }: { children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void }) {
  const { colors, space } = useTheme();
  const body = { padding: space.lg, gap: space.lg };
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={body} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
