'use client';

import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/page-header';
import { ProfileSummary } from '@/features/dashboard/components/profile-summary';
import { RecentNotifications } from '@/features/dashboard/components/recent-notifications';
import { RecentActivity } from '@/features/dashboard/components/recent-activity';
import { RegistrationCard } from '@/features/dashboard/components/registration-card';
import { StudentStanding } from '@/features/dashboard/components/student-standing';

function greeting() {
  const hour = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Africa/Accra' }));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const me = useAuthStore((s) => s.me);
  return (
    <>
      <PageHeader title={`${greeting()}, ${me?.firstName}`} />
      <div className="flex flex-col gap-4">
        <ProfileSummary />
        {me?.type === 'STUDENT' && <StudentStanding />}
        {me?.type === 'STUDENT' && <RegistrationCard />}
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentNotifications />
          <RecentActivity />
        </div>
      </div>
    </>
  );
}
