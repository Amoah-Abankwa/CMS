'use client';

import { Select } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import type { AssignableRole, RoleSelection, SchoolNode } from '../api';

interface Props {
  roles: AssignableRole[];
  schools: SchoolNode[];
  value: RoleSelection;
  onChange: (value: RoleSelection) => void;
  disabled?: boolean;
}

/**
 * Tick every role the person holds. Head of Department asks for a department and Dean for a
 * school. "Signs in as" picks the role they land in; they can switch to the others at any time.
 */
export function RolePicker({ roles, schools, value, onChange, disabled }: Props) {
  const selected = new Map(value.roles.map((r) => [r.roleKey, r]));
  // Roles arrive in display order; group consecutive roles under their area heading.
  const groups: Array<{ label: string; roles: AssignableRole[] }> = [];
  for (const role of roles) {
    const last = groups[groups.length - 1];
    if (last?.label === role.categoryLabel) last.roles.push(role);
    else groups.push({ label: role.categoryLabel, roles: [role] });
  }

  const toggle = (key: string, on: boolean) => {
    const next = on ? [...value.roles, { roleKey: key }] : value.roles.filter((r) => r.roleKey !== key);
    const primaryStillValid = next.some((r) => r.roleKey === value.primaryRoleKey);
    onChange({ roles: next, primaryRoleKey: primaryStillValid ? value.primaryRoleKey : next[0]?.roleKey ?? '' });
  };

  const setScope = (key: string, scopeId: string) =>
    onChange({ ...value, roles: value.roles.map((r) => (r.roleKey === key ? { ...r, scopeId: scopeId || undefined } : r)) });

  return (
    <div className="flex flex-col gap-4">
      <fieldset disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Roles</legend>
        <p className="mb-3 text-xs text-muted">
          {value.roles.length === 0 ? 'Tick every role this person holds.' : `${value.roles.length} selected.`}
        </p>
        <div className="flex flex-col gap-4">
        {groups.map((group) => (
        <div key={group.label}>
        <p className="mb-1.5 text-xs font-medium text-muted">{group.label}</p>
        <ul className="divide-y divide-border rounded-md border border-border">
          {group.roles.map((role) => {
            const choice = selected.get(role.key);
            const id = `role-${role.key}`;
            return (
              <li key={role.key} className={cn('px-3 py-2.5', choice && 'bg-primary-soft/50')}>
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
                  <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0" checked={!!choice} onChange={(e) => toggle(role.key, e.target.checked)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{role.name}</span>
                    {role.description && <span className="block text-xs text-muted">{role.description}</span>}
                  </span>
                </label>
                {choice && role.scopeType && (
                  <div className="mt-2 pl-7">
                    <label htmlFor={`${id}-scope`} className="sr-only">
                      {role.scopeType === 'department' ? 'Department' : 'School'} for {role.name}
                    </label>
                    <Select id={`${id}-scope`} value={choice.scopeId ?? ''} onChange={(e) => setScope(role.key, e.target.value)} aria-invalid={!choice.scopeId}>
                      <option value="">{role.scopeType === 'department' ? 'Choose the department' : 'Choose the school'}</option>
                      {role.scopeType === 'school'
                        ? schools.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))
                        : schools.map((s) => (
                            <optgroup key={s.id} label={s.name}>
                              {s.departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                    </Select>
                    {role.singleHolder && <p className="mt-1 text-xs text-muted">Only one person can hold this at a time.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </div>
        ))}
        </div>
      </fieldset>

      {value.roles.length > 1 && (
        <Field label="Signs in as" htmlFor="primary-role" hint="They can switch to their other roles from the sidebar.">
          <Select id="primary-role" disabled={disabled} value={value.primaryRoleKey} onChange={(e) => onChange({ ...value, primaryRoleKey: e.target.value })}>
            {value.roles.map((r) => (
              <option key={r.roleKey} value={r.roleKey}>
                {roles.find((x) => x.key === r.roleKey)?.name ?? r.roleKey}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}
