
'use client';

import { useAuthStore } from '@/stores/auth.store';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

function Item({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">
        {value ?? '—'}
      </dd>
    </div>
  );
}

export function ProfileSummary() {
  const me = useAuthStore((s) => s.me);

  if (!me) return null;

  const role = me.roles.find((r) => r.key === me.activeRoleKey)?.name;

  return (
    <Card className="w-full">
      <CardHeader title="Your profile" />

      <CardBody>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {me.studentProfile ? (
            <>
              <Item label="Index number" value={me.indexNumber} />
              <Item
                label="Programme"
                value={me.studentProfile.programme.name}
              />
              <Item
                label="Level"
                value={me.studentProfile.currentLevel}
              />
              <Item
                label="Admitted"
                value={me.studentProfile.admissionYear}
              />
            </>
          ) : (
            <>
              <Item
                label="Staff number"
                value={me.staffProfile?.staffNumber}
              />
              <Item
                label="Department"
                value={me.staffProfile?.department?.name}
              />
              <Item label="Active role" value={role} />
              <Item label="Email" value={me.email} />
            </>
          )}
        </dl>
      </CardBody>
    </Card>
  );
}