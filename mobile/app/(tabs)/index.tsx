import { View } from 'react-native';
import { Notice } from '@/components/states/Notice';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { FeesGlance } from '@/features/home/FeesGlance';
import { QuickLinks } from '@/features/home/QuickLinks';
import { StudentSummary } from '@/features/home/StudentSummary';
import { useAuth } from '@/stores/auth';
import { usePrefs } from '@/stores/preferences';
import { useTheme } from '@/theme/useTheme';

export default function Home() {
  const { space } = useTheme();
  const me = useAuth((s) => s.me);
  const lite = usePrefs((s) => s.lite);
  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Text variant="title">Hello{me ? `, ${me.firstName}` : ''}</Text>
        {me?.indexNumber ? <Text tone="muted">{me.indexNumber}</Text> : null}
      </View>
      {me?.mustChangePassword ? <Notice tone="warning" title="Change your password">Your password must be changed before you can use everything. Do it on the website, then sign in here again.</Notice> : null}
      {me?.type === 'STUDENT' ? (
        <>
          <StudentSummary />
          {lite ? <Text variant="small" tone="muted">Lite mode is on: fees load when you open the Fees tab.</Text> : <FeesGlance />}
        </>
      ) : (
        <>
          <Card>
            <Text variant="heading">{[me?.staffProfile?.title, me?.firstName, me?.lastName].filter(Boolean).join(' ')}</Text>
            <Text tone="muted">{me?.roles.map((r) => r.name).join(', ')}</Text>
          </Card>
          <QuickLinks />
        </>
      )}
    </Screen>
  );
}
