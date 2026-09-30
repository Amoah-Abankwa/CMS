'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/states';
import { errorMessage } from '@/lib/axios';
import { selectionProblem, staffApi, type RoleSelection, type StaffMember } from '../api';
import { staffDetailsSchema, type StaffDetailsValues } from '../schemas';
import { useRoleOptions } from '../use-role-options';
import { RolePicker } from './role-picker';

export function CreateStaffForm({ onCreatedAction }: { onCreatedAction: (m: StaffMember) => void }) {
  const { roles, schools, error: loadError } = useRoleOptions();
  const [selection, setSelection] = useState<RoleSelection>({ roles: [], primaryRoleKey: '' });
  const [roleError, setRoleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<StaffDetailsValues>({
    resolver: zodResolver(staffDetailsSchema),
    defaultValues: { isTeaching: false },
  });
  const e = formState.errors;

  const onSubmit = handleSubmit(async (details) => {
    setError(null);
    const problem = roles ? selectionProblem(selection, roles) : 'Roles are still loading.';
    setRoleError(problem);
    if (problem) return;
    try {
      onCreatedAction(await staffApi.create({ ...details, departmentId: details.departmentId || undefined, ...selection }));
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (loadError) return <Alert tone="danger">{loadError}</Alert>;
  if (!roles) return <Spinner />;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {error && <Alert tone="danger">{error}</Alert>}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <legend className="mb-3 text-sm font-semibold">Personal details</legend>
        <Field label="Title (optional)" htmlFor="title">
          <Select id="title" {...register('title')}>
            <option value="">None</option>
            {['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Rev', 'Rev Dr'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="First name" htmlFor="firstName" error={e.firstName?.message}>
          <Input id="firstName" aria-invalid={!!e.firstName} {...register('firstName')} />
        </Field>
        <Field label="Middle name (optional)" htmlFor="middleName">
          <Input id="middleName" {...register('middleName')} />
        </Field>
        <Field label="Surname" htmlFor="lastName" error={e.lastName?.message}>
          <Input id="lastName" aria-invalid={!!e.lastName} {...register('lastName')} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Contact and employment</legend>
        <Field label="Staff email" htmlFor="email" hint="They sign in with this, and the setup link goes here." error={e.email?.message}>
          <Input id="email" type="email" placeholder="name@anu.edu.gh" aria-invalid={!!e.email} {...register('email')} />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={e.phone?.message}>
          <Input id="phone" type="tel" inputMode="tel" placeholder="024 123 4567" aria-invalid={!!e.phone} {...register('phone')} />
        </Field>
        <Field label="Staff number" htmlFor="staffNumber" error={e.staffNumber?.message}>
          <Input id="staffNumber" autoCapitalize="characters" aria-invalid={!!e.staffNumber} {...register('staffNumber')} />
        </Field>
        <Field label="Department (optional)" htmlFor="departmentId" hint="Leave empty for central offices such as the Registry or Library.">
          <Select id="departmentId" {...register('departmentId')}>
            <option value="">No department</option>
            {schools.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {s.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="size-4" {...register('isTeaching')} />
          Teaching staff
        </label>
      </fieldset>

      <div className="flex flex-col gap-2">
        <RolePicker roles={roles} schools={schools} value={selection} onChange={(v) => { setSelection(v); setRoleError(null); }} />
        {roleError && (
          <p className="text-xs text-danger" role="alert">
            {roleError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">They receive an email with a link to choose their password. You will be asked for your authenticator code.</p>
        <Button type="submit" loading={formState.isSubmitting} className="shrink-0">
          Create staff account
        </Button>
      </div>
    </form>
  );
}
