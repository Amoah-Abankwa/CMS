import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Notice } from '@/components/states/Notice';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CodeStep } from '@/features/auth/CodeStep';
import { EnrolStep } from '@/features/auth/EnrolStep';
import { StaffForm } from '@/features/auth/StaffForm';
import { StudentForm } from '@/features/auth/StudentForm';
import type { StaffStep } from '@/features/auth/api';
import { useAuth } from '@/stores/auth';
import { useDrafts } from '@/stores/drafts';
import { useTheme } from '@/theme/useTheme';

export default function SignIn() {
  const { space } = useTheme();
  const status = useAuth((s) => s.status);
  const expired = useAuth((s) => s.signedOutReason === 'expired');
  const savedWork = useDrafts((s) => Object.keys(s.drafts).some((k) => !k.startsWith('sign-in.')));
  const [who, setWho] = useState<'student' | 'staff'>('student');
  const [step, setStep] = useState<(StaffStep & { replacing?: boolean }) | null>(null);
  if (status === 'signed_in') return <Redirect href="/(tabs)" />;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: space.xs }}>
          <Text variant="title">Sign in to ANU</Text>
          <Text tone="muted">All Nations University</Text>
        </View>
        {expired ? (
          <Notice tone="info" title="Your session ended">
            {savedWork ? 'For your security you were signed out. What you were writing is saved on this phone and will be there after you sign in.' : 'For your security you were signed out after a while. Sign in again to carry on.'}
          </Notice>
        ) : null}
        {!step ? (
          <>
            <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="tablist">
              <Chip label="Student" selected={who === 'student'} onPress={() => setWho('student')} />
              <Chip label="Staff" selected={who === 'staff'} onPress={() => setWho('staff')} />
            </View>
            {who === 'student' ? <StudentForm /> : <StaffForm onNext={setStep} />}
          </>
        ) : step.status === 'mfa_required' ? (
          <CodeStep challengeToken={step.challengeToken} onBack={() => setStep(null)} onNext={(s) => setStep({ ...s, replacing: true })} />
        ) : (
          <EnrolStep challengeToken={step.challengeToken} replacing={!!step.replacing} />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
