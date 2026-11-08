import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';

/** The running total against the term's limits, and what to do about it. */
export function CreditBar({ credits, min, max }: { credits: number; min: number; max: number }) {
  const over = credits > max;
  const under = credits < min;
  return (
    <Card>
      <Text variant="heading" tone={over ? 'danger' : 'default'}>{credits} of {max} credits</Text>
      <ProgressBar value={credits / max} />
      <Text variant="small" tone={over ? 'danger' : under ? 'warning' : 'muted'}>
        {over ? `Remove ${credits - max} credits to stay within the limit.` : under ? `Add at least ${min - credits} more credits before submitting (the minimum is ${min}).` : 'Within the limits for this term.'}
      </Text>
    </Card>
  );
}
