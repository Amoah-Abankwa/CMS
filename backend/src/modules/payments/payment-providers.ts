import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InitializeInput {
  reference: string;
  amount: number;
  currency: 'GHS' | 'USD';
  email: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface VerifyResult {
  status: 'success' | 'failed' | 'pending';
  amount: number;
  currency: string;
  channel?: string;
  paidAt?: Date;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: 'demo' | 'paystack';
  initialize(input: InitializeInput): Promise<{ authorizationUrl: string }>;
  verify(reference: string, stored: { amount: number; currency: string; providerData: unknown }): Promise<VerifyResult>;
  refund(reference: string, amount: number): Promise<'REFUNDED' | 'REFUND_PENDING'>;
  /** True if the webhook body really came from the provider. */
  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean;
  /** Sends money from the university's balance to a mobile money number. */
  transfer(input: TransferInput): Promise<{ status: 'success' | 'pending' | 'failed'; transferCode?: string; message?: string }>;
}

export interface TransferInput {
  amount: number;
  bankCode: string;
  number: string;
  name: string;
  reference: string;
  reason: string;
}

/**
 * Simulated checkout for demos and development. The customer is sent to a page in this app that
 * says clearly no money moves, and chooses whether the payment succeeds or fails.
 */
export class DemoPaymentProvider implements PaymentProvider {
  readonly name = 'demo' as const;
  constructor(private readonly webOrigin: string) {}

  async initialize(input: InitializeInput) {
    return { authorizationUrl: `${this.webOrigin}/pay/demo?reference=${encodeURIComponent(input.reference)}&next=${encodeURIComponent(input.callbackUrl)}` };
  }

  async verify(_reference: string, stored: { amount: number; currency: string; providerData: unknown }): Promise<VerifyResult> {
    const outcome = (stored.providerData as { demoOutcome?: string } | null)?.demoOutcome;
    return { status: outcome === 'success' ? 'success' : outcome === 'failed' ? 'failed' : 'pending', amount: stored.amount, currency: stored.currency, channel: 'demo', paidAt: new Date() };
  }

  async refund() {
    return 'REFUNDED' as const;
  }

  verifyWebhook() {
    return false;
  }

  /** Demo: every transfer succeeds at once; no money moves. */
  async transfer() {
    return { status: 'success' as const, transferCode: 'DEMO' };
  }
}

/**
 * Paystack (https://paystack.com/docs/api). Amounts are in pesewas for GHS. Mobile money (MTN, Telecel,
 * AirtelTigo) and cards are offered. Payments are confirmed by verifying the transaction from the server,
 * never by trusting the browser redirect alone.
 */
export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = 'paystack' as const;
  private readonly base = 'https://api.paystack.co';

  constructor(private readonly secretKey: string) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: unknown };
    if (!res.ok || !body.status) throw new Error(`Paystack: ${body.message ?? res.statusText}`);
    return body.data as T;
  }

  async initialize(input: InitializeInput) {
    const data = await this.call<{ authorization_url: string }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amount,
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: ['mobile_money', 'card'],
        metadata: input.metadata,
      }),
    });
    return { authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const d = await this.call<{ status: string; amount: number; currency: string; channel?: string; paid_at?: string }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    return {
      status: d.status === 'success' ? 'success' : ['failed', 'abandoned', 'reversed'].includes(d.status) ? 'failed' : 'pending',
      amount: d.amount,
      currency: d.currency,
      channel: d.channel,
      paidAt: d.paid_at ? new Date(d.paid_at) : undefined,
      raw: { status: d.status, channel: d.channel },
    };
  }

  async refund(reference: string, amount: number) {
    await this.call('/refund', { method: 'POST', body: JSON.stringify({ transaction: reference, amount }) });
    // Paystack processes refunds asynchronously and reports completion by webhook.
    return 'REFUND_PENDING' as const;
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature) return false;
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Paystack Transfers (https://paystack.com/docs/transfers): create a mobile money recipient, then send
   * from the balance. Paystack may hold a transfer for OTP approval if that is switched on for the
   * account; it then completes by webhook (transfer.success / transfer.failed).
   */
  async transfer(input: TransferInput) {
    try {
      const recipient = await this.call<{ recipient_code: string }>('/transferrecipient', {
        method: 'POST',
        body: JSON.stringify({ type: 'mobile_money', name: input.name, account_number: input.number, bank_code: input.bankCode, currency: 'GHS' }),
      });
      const t = await this.call<{ status: string; transfer_code: string }>('/transfer', {
        method: 'POST',
        body: JSON.stringify({ source: 'balance', amount: input.amount, recipient: recipient.recipient_code, reason: input.reason, reference: input.reference, currency: 'GHS' }),
      });
      return { status: t.status === 'success' ? ('success' as const) : t.status === 'failed' ? ('failed' as const) : ('pending' as const), transferCode: t.transfer_code };
    } catch (err) {
      return { status: 'failed' as const, message: (err as Error).message };
    }
  }
}
