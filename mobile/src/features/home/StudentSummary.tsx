import { View } from 'react-native';
import { router } from 'expo-router';
import { termName } from '@anu/shared';
import { EmptyState } from '@/components/states/EmptyState';
import { QueryView } from '@/components/states/QueryView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';

interface Registration {
  semester: { number: number; academicYear: { label: string } };
  profile: { level: number; department?: string; programme: { name: string } };
  registration: { status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'; reference?: string } | null;
}
const STATUS = { DRAFT: ['Not submitted', 'neutral'], SUBMITTED: ['Waiting for approval', 'warning'], APPROVED: ['Approved', 'success'], REJECTED: ['Returned for changes', 'danger'] } as const;

/** Programme, level, the current term and course registration status. */
export function StudentSummary() {
  const { space } = useTheme();
  const q = useQuery<Registration>('me.registration', '/me/registration');
  return (
    <QueryView q={q} skeleton={<SkeletonCard lines={4} />}>
      {(d) => (
        <Card>
          <Text variant="heading">{d.profile.programme.name}</Text>
          <Text tone="muted">{[d.profile.department, `Level ${d.profile.level}`].filter(Boolean).join(', ')}</Text>
          <Text>{d.semester.academicYear.label} {termName(d.semester.number)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text variant="small" tone="muted">Course registration</Text>
            {d.registration ? <Badge label={STATUS[d.registration.status][0]} tone={STATUS[d.registration.status][1]} /> : <Badge label="Not started" />}
          </View>
          {!d.registration ? <EmptyState title="You have not registered yet" why="Courses for this term are chosen on the website for now; the app shows them once approved." action={{ label: 'See my courses', onPress: () => router.push('/(tabs)/courses') }} /> : null}
        </Card>
      )}
    </QueryView>
  );
}
