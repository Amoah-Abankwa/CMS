import { Switch } from 'react-native';
import { EmptyState } from '@/components/states/EmptyState';
import { FormError } from '@/components/states/FormError';
import { QueryView } from '@/components/states/QueryView';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';

/** Whether unpaid departmental dues show on each department's exam registers. */
export default function DuesMarker() {
  const { colors } = useTheme();
  const q = useQuery<Array<{ id: string; name: string; showDuesOnRegister: boolean }>>('dues.marker', '/exams/dues-marker');
  const { error, run } = useSubmit();
  return (
    <Screen refreshing={q.loading} onRefresh={q.refresh}>
      <Header title="Dues on exam registers" subtitle="Invigilators see who has not paid departmental dues. It never stops anyone sitting the paper." />
      <FormError error={error} />
      <QueryView q={q} skeleton={<SkeletonList rows={3} />}>
        {(list) => list.length === 0 ? <EmptyState title="No departments" why="You can change this for departments you lead." /> : <>{list.map((d) => (
          <Card key={d.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1 }}>{d.name}</Text>
            <Switch value={d.showDuesOnRegister} onValueChange={(on) => void run(async () => { await axiosInstance.post(`/exams/dues-marker/${d.id}`, { on }); q.refresh(); })} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={`Show dues for ${d.name}`} />
          </Card>
        ))}</>}
      </QueryView>
    </Screen>
  );
}
