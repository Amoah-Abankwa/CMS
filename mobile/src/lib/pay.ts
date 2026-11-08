import { Linking } from 'react-native';

/** Opens Paystack's secure page in the browser. The backend records the payment once Paystack confirms it. */
export async function openPayment(paymentUrl: string) {
  await Linking.openURL(paymentUrl);
}
