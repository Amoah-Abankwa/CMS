import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ClearanceAndRequests, ReadingLists } from '@/features/library/Extras';
import { Loans } from '@/features/library/Loans';
import { Search } from '@/features/library/Search';
import { useTheme } from '@/theme/useTheme';

const TABS = { loans: 'My loans', find: 'Find a book', lists: 'Reading lists', more: 'Clearance and requests' } as const;

export default function Library() {
  const { space } = useTheme();
  const [tab, setTab] = useState<keyof typeof TABS>('loans');
  return (
    <Screen>
      <Header title="Library" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {(Object.keys(TABS) as Array<keyof typeof TABS>).map((k) => <Chip key={k} label={TABS[k]} selected={tab === k} onPress={() => setTab(k)} />)}
      </ScrollView>
      {tab === 'loans' ? <Loans /> : tab === 'find' ? <Search /> : tab === 'lists' ? <ReadingLists /> : <ClearanceAndRequests />}
    </Screen>
  );
}
