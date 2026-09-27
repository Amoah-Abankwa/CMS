import { createHmac } from 'node:crypto';
import { PaystackPaymentProvider } from './payment-providers';

describe('Paystack webhook signature', () => {
  const provider = new PaystackPaymentProvider('sk_test_example');
  const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ANU-TEST' } }));
  const signature = createHmac('sha512', 'sk_test_example').update(body).digest('hex');

  it('accepts a body signed with the secret key', () => {
    expect(provider.verifyWebhook(body, signature)).toBe(true);
  });

  it('rejects a changed body, a wrong signature, or none', () => {
    expect(provider.verifyWebhook(Buffer.from(body.toString().replace('ANU-TEST', 'ANU-OTHER')), signature)).toBe(false);
    expect(provider.verifyWebhook(body, 'a'.repeat(128))).toBe(false);
    expect(provider.verifyWebhook(body, undefined)).toBe(false);
  });
});
