import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, type DimensionValue } from 'react-native';
import { useTheme } from '@/theme/useTheme';

/** A grey block in the shape of what is coming. Pulses gently, or stays still if reduced motion is on. */
export function Skeleton({ width = '100%', height = 14, round }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const { colors, radius } = useTheme();
  const opacity = useRef(new Animated.Value(0.6)).current;
  const [still, setStill] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setStill); }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [opacity, still]);
  return <Animated.View style={{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.surfaceMuted, opacity }} />;
}

/** The outline of a card: a heading and a few lines. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { colors, radius, space } = useTheme();
  return (
    <View accessible accessibilityLabel="Loading" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border }}>
      <Skeleton width="45%" height={18} />
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} width={(['92%', '78%', '64%'] as const)[i % 3]} />)}
    </View>
  );
}

/** The outline of a list of rows. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const { space } = useTheme();
  return (
    <View accessible accessibilityLabel="Loading" style={{ gap: space.md }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Skeleton width={40} height={40} round />
          <View style={{ flex: 1, gap: space.xs }}><Skeleton width="70%" /><Skeleton width="40%" height={12} /></View>
        </View>
      ))}
    </View>
  );
}
