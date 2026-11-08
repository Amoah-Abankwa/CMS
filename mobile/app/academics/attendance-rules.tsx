import type { AttendancePolicy } from '@anu/shared';
import { attendanceApi } from '@/api/attendance';
import { QueryView } from '@/components/states/QueryView';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { NumberSettings } from '@/features/approvals/NumberSettings';
import { useQuery } from '@/hooks/useQuery';

export default function AttendanceRules() {
  const q = useQuery<AttendancePolicy>('att.policy', '/attendance/policy');
  return (
    <Screen>
      <Header title="Attendance rules" />
      <QueryView q={q} skeleton={<SkeletonCard lines={3} />}>
        {(p) => <NumberSettings initial={p as unknown as Record<string, number>} savedText="Lecturers and students see the new rules on their attendance pages." onSave={async (v) => { await attendanceApi.setPolicy(v as unknown as AttendancePolicy); q.refresh(); }} fields={[
          { key: 'minimumPercent', label: 'Minimum attendance (%)', min: 0, max: 100, hint: 'Students below this are flagged and may not sit the exam.' },
          { key: 'lateAfterMinutes', label: 'Late after (minutes from the start)', min: 0, max: 120 },
          { key: 'checkInMinutes', label: 'Check-in stays open (minutes)', min: 1, max: 180 },
        ]} />}
      </QueryView>
    </Screen>
  );
}
