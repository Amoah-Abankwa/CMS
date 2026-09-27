'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { useAuthStore } from '@/stores/auth.store';
import { errorMessage } from '@/lib/axios';
import { selectionProblem, staffApi, toSelection, type RoleSelection, type StaffMember } from '../api';
import { useRoleOptions } from '../use-role-options';
import { RolePicker } from './role-picker';

export function StaffRolesEditor({ member, canEdit, onSaved }: { member: StaffMember; canEdit: boolean; onSaved: (m: StaffMember) => void }) {
  const myId = useAuthStore((s) => s.me?.id);
  const { roles, schools, error: loadError } = useRoleOptions();
  const [selection, setSelection] = useState<RoleSelection>(() => toSelection(member));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSelf = member.id === myId;
  const locked = !canEdit || isSelf;

  const save = async () => {
    if (!roles) return;
    const problem = selectionProblem(selection, roles);
    setError(problem);
    setSaved(false);
    if (problem) return;
    setBusy(true);
    try {
      const updated = await staffApi.updateRoles(member.id, selection);
      setSelection(toSelection(updated));
      setSaved(true);
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <Alert tone="danger">{loadError}</Alert>;
  if (!roles) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {isSelf && <Alert tone="info">Another Super Admin must change your own roles.</Alert>}
      {!canEdit && !isSelf && <Alert tone="info">Only a Super Admin can change roles.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Roles saved. {member.status === 'ACTIVE' ? 'They have been notified.' : ''}</Alert>}
      <RolePicker roles={roles} schools={schools} value={selection} onChange={(v) => { setSelection(v); setSaved(false); }} disabled={locked} />
      {!locked && (
        <div className="flex gap-2">
          <Button onClick={save} loading={busy}>
            Save roles
          </Button>
          <Button variant="ghost" onClick={() => setSelection(toSelection(member))}>
            Undo changes
          </Button>
        </div>
      )}
    </div>
  );
}
