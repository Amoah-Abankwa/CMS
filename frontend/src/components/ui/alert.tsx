import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const STYLES: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-primary/30 bg-primary-soft text-text', Icon: Info },
  success: { box: 'border-success/30 bg-success-soft text-text', Icon: CheckCircle2 },
  warning: { box: 'border-warning/30 bg-warning-soft text-text', Icon: TriangleAlert },
  danger: { box: 'border-danger/30 bg-danger-soft text-text', Icon: AlertCircle },
};

export function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  const { box, Icon } = STYLES[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border px-3 py-2.5 text-sm', box)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-muted' : ''}>{children}</div>}
      </div>
    </div>
  );
}
