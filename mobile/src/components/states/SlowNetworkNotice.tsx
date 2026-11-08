import { View } from 'react-native';
import type { Progress } from '@/hooks/useQuery';
import { useTheme } from '@/theme/useTheme';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { Text } from '../ui/Text';
import { Notice } from './Notice';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** A slow connection: show real progress, and offer a lighter path. */
export function SlowNetworkNotice({ progress, lighter }: { progress: Progress | null; lighter: { label: string; onPress: () => void } }) {
  const { space } = useTheme();
  const fraction = progress?.total ? progress.loaded / progress.total : null;
  const detail = progress
    ? progress.total
      ? `${kb(progress.loaded)} of ${kb(progress.total)} received`
      : `${kb(progress.loaded)} received so far`
    : 'Waiting for the first data to arrive';
  return (
    <Notice tone="warning" title="The connection is slow">
      <View style={{ gap: space.sm }}>
        <ProgressBar value={fraction} />
        <Text variant="small">{detail}.</Text>
        <Button label={lighter.label} variant="secondary" onPress={lighter.onPress} />
      </View>
    </Notice>
  );
}
