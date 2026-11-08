import { useState } from 'react';
import { Linking, View } from 'react-native';
import { formatMoney } from '@anu/shared';
import { SuccessState } from '@/components/states/SuccessState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { FormError } from '@/components/states/FormError';
import { useSubmit } from '@/hooks/useSubmit';
import { axiosInstance } from '@/lib/api';
import { openPdf } from '@/lib/files';
import { useTheme } from '@/theme/useTheme';
import { balanceOf, type MyBill } from './types';

const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** One term's bill: what is owed, what is due next, and paying online (Paystack opens in the browser). */
export function BillCard({ bill, onPaid }: { bill: MyBill; onPaid: () => void }) {
  const { space } = useTheme();
  const owed = balanceOf(bill);
  const next = bill.instalments?.next ?? null;
  const { busy, error, run } = useSubmit();
  const [started, setStarted] = useState(false);
  const pay = (amount: number) =>
    void run(async () => {
      const r = await axiosInstance.post<{ paymentUrl: string }>('/me/fees/pay', { billId: bill.id, amount });
      await Linking.openURL(r.data.paymentUrl);
      setStarted(true);
    });
  if (started) {
    return <SuccessState title="Payment started" reassurance="Paystack is handling your payment securely. If you closed it before finishing, nothing was taken." next="Your balance updates once Paystack confirms, usually within a minute. Pull down to refresh." action={{ label: 'Refresh my balance', onPress: () => { setStarted(false); onPaid(); } }} />;
  }
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading">{bill.semesterLabel}</Text>
        {bill.cleared ? <Badge label="Cleared for exams" tone="success" /> : null}
      </View>
      <Text variant="title" tone={owed ? 'default' : 'success'}>{owed ? formatMoney(owed, bill.currency) : 'Paid in full'}</Text>
      <Text variant="small" tone="muted">Charged {formatMoney(bill.charged + bill.adjustments, bill.currency)}, paid {formatMoney(bill.paid, bill.currency)}</Text>
      {next ? <Text>Next instalment: {formatMoney(next.toPay, bill.currency)} by {day(next.dueDate)}</Text> : null}
      <FormError error={error} />
      <Button label="Statement and receipts (PDF)" variant="ghost" onPress={() => void run(() => openPdf(`/me/fees/statements/${bill.id}/pdf`, `fees-statement-${bill.semesterLabel}.pdf`))} />
      {owed ? (
        <View style={{ gap: space.sm }}>
          {next && next.toPay > 0 && next.toPay < owed ? <Button label={`Pay ${formatMoney(next.toPay, bill.currency)} (next instalment)`} loading={busy} onPress={() => pay(next.toPay)} /> : null}
          <Button label={`Pay the full ${formatMoney(owed, bill.currency)}`} variant={next && next.toPay < owed ? 'secondary' : 'primary'} loading={busy} onPress={() => pay(owed)} />
        </View>
      ) : null}
    </Card>
  );
}
