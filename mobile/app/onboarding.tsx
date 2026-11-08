import { useRef, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { usePrefs } from '@/stores/preferences';
import { useTheme } from '@/theme/useTheme';

const SLIDES = [
  { title: 'Your studies in one place', body: 'Register for courses, see your timetable, results and trailing courses, and get your registration slip.' },
  { title: 'Fees without the queue', body: 'See what you owe and what is due next, pay with mobile money or card, and keep every receipt.' },
  { title: 'Works on a weak connection', body: 'Screens you have opened stay readable offline, and anything you are writing is saved as you type.' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const { colors, space, radius } = useTheme();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const done = usePrefs((s) => s.setOnboarded);
  const finish = () => { done(); router.replace('/sign-in'); };
  const last = index === SLIDES.length - 1;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ alignItems: 'flex-end', paddingHorizontal: space.lg }}>
        <Button label="Skip" variant="ghost" onPress={finish} />
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, padding: space.xl, justifyContent: 'center', gap: space.md }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.primarySoft }} />
            <Text variant="title">{item.title}</Text>
            <Text tone="muted">{item.body}</Text>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginBottom: space.lg }} accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((s, i) => <View key={s.title} style={{ width: i === index ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.primary : colors.border }} />)}
      </View>
      <View style={{ padding: space.lg }}>
        <Button label={last ? 'Get started' : 'Next'} onPress={() => {
          if (last) return finish();
          list.current?.scrollToIndex({ index: index + 1 });
          setIndex(index + 1);
        }} />
      </View>
    </SafeAreaView>
  );
}
