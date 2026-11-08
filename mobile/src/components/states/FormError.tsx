import type { Described } from '@/lib/errors';
import { Notice } from './Notice';
import { Text } from '@/components/ui/Text';

/** A failed sign-in step: what went wrong, whose fault, how to fix it. */
export function FormError({ error }: { error: Described | null }) {
  if (!error) return null;
  return (
    <Notice tone="danger" title={error.what}>
      <Text variant="small">{error.whose} {error.fix}</Text>
    </Notice>
  );
}
