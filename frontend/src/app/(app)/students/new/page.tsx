'use client';

import { useState } from 'react';
import { PERMISSIONS } from '@anu/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RegisterStudentForm } from '@/features/students/components/register-student-form';
import { RegistrationResult } from '@/features/students/components/registration-result';
import type { RegisteredStudent } from '@/features/students/api';

export default function RegisterStudentPage() {
  const [result, setResult] = useState<RegisteredStudent | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <RequirePermission permission={PERMISSIONS.STUDENTS_REGISTER}>
      <PageHeader
        title="Register a student"
        description="Creates the student account and assigns the next index number for the programme level and admission year."
      />

      <Card>
        <CardBody>
          {result ? (
            <RegistrationResult
              student={result}
              onAnother={() => {
                setResult(null);
                setFormKey((k) => k + 1);
              }}
            />
          ) : (
            <RegisterStudentForm
              key={formKey}
              onRegisteredAction={setResult}
            />
          )}
        </CardBody>
      </Card>
    </RequirePermission>
  );
}