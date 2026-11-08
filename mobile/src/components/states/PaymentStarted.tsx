import { SuccessState } from './SuccessState';

/** After handing over to Paystack: confirm, reassure, and say what happens next. */
export function PaymentStarted({ what, onRefresh }: { what: string; onRefresh: () => void }) {
  return <SuccessState title="Payment started" reassurance={`Paystack is handling the payment for ${what} securely. If you closed it before finishing, nothing was taken.`} next="This updates once Paystack confirms, usually within a minute." action={{ label: 'Check now', onPress: onRefresh }} />;
}
