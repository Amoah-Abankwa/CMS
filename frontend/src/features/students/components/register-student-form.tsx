'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Alert } from '@/components/ui/alert';
import { errorMessage } from '@/lib/axios';
import {
  studentsApi,
  type ProgrammeOption,
  type RegisteredStudent,
} from '../api';
import {
  registerStudentSchema,
  type RegisterStudentValues,
} from '../schemas';

export function RegisterStudentForm({
  onRegisteredAction,
}: {
  onRegisteredAction: (student: RegisteredStudent) => void;
}) {
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState,
  } = useForm<RegisterStudentValues>({
    resolver: zodResolver(registerStudentSchema),
    defaultValues: {
      admissionYear: new Date().getFullYear(),
      nationality: 'Ghanaian',
      gender: '',
    },
  });

  const e = formState.errors;

  useEffect(() => {
    studentsApi
      .programmes()
      .then(setProgrammes)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const onSubmit = handleSubmit(
    async (values: RegisterStudentValues) => {
      setError(null);

      try {
        const payload = {
          ...values,
          phone: values.phone.replace(/\s/g, ''),
          middleName: values.middleName || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender || undefined,
          nationality: values.nationality || undefined,
        };

        const student = await studentsApi.register(payload);

        onRegisteredAction(student);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold">
          Personal details
        </legend>

        <Field
          label="First name"
          htmlFor="firstName"
          error={e.firstName?.message}
        >
          <Input
            id="firstName"
            autoComplete="off"
            aria-invalid={!!e.firstName}
            {...register('firstName')}
          />
        </Field>

        <Field
          label="Middle name (optional)"
          htmlFor="middleName"
          error={e.middleName?.message}
        >
          <Input
            id="middleName"
            autoComplete="off"
            {...register('middleName')}
          />
        </Field>

        <Field
          label="Surname"
          htmlFor="lastName"
          error={e.lastName?.message}
        >
          <Input
            id="lastName"
            autoComplete="off"
            aria-invalid={!!e.lastName}
            {...register('lastName')}
          />
        </Field>

        <Field
          label="Date of birth (optional)"
          htmlFor="dateOfBirth"
          error={e.dateOfBirth?.message}
        >
          <Input
            id="dateOfBirth"
            type="date"
            {...register('dateOfBirth')}
          />
        </Field>

        <Field
          label="Gender (optional)"
          htmlFor="gender"
          error={e.gender?.message}
        >
          <Select id="gender" {...register('gender')}>
            <option value="">Not stated</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </Select>
        </Field>

        <Field
          label="Nationality (optional)"
          htmlFor="nationality"
          error={e.nationality?.message}
        >
          <Input
            id="nationality"
            {...register('nationality')}
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">
          Contact
        </legend>

        <Field
          label="Email"
          htmlFor="email"
          hint="Sign-in details and notifications go here."
          error={e.email?.message}
        >
          <Input
            id="email"
            type="email"
            aria-invalid={!!e.email}
            {...register('email')}
          />
        </Field>

        <Field
          label="Phone"
          htmlFor="phone"
          hint="Used for SMS alerts."
          error={e.phone?.message}
        >
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="024 123 4567"
            aria-invalid={!!e.phone}
            {...register('phone')}
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold">
          Admission
        </legend>

        <div className="sm:col-span-2">
          <Field
            label="Programme"
            htmlFor="programmeId"
            error={e.programmeId?.message}
          >
            <Select
              id="programmeId"
              aria-invalid={!!e.programmeId}
              defaultValue=""
              {...register('programmeId')}
            >
              <option value="" disabled>
                Choose a programme
              </option>

              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.level.name})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Admission year"
          htmlFor="admissionYear"
          error={e.admissionYear?.message}
        >
          <Input
            id="admissionYear"
            type="number"
            inputMode="numeric"
            aria-invalid={!!e.admissionYear}
            {...register('admissionYear', {
              valueAsNumber: true,
            })}
          />
        </Field>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          The index number is assigned automatically. The
          student receives sign-in details by email and SMS.
        </p>

        <Button
          type="submit"
          loading={formState.isSubmitting}
          className="shrink-0"
        >
          Register student
        </Button>
      </div>
    </form>
  );
}