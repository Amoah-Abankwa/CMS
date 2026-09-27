import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { loadEnv } from '../../core/config/env';
import { AuditService } from '../audit/audit.service';
import { DemoPaymentProvider, PaymentProvider, PaystackPaymentProvider } from './payment-providers';

type Handler = (payment: { id: string; orderId: string | null; userId: string; amount: number }) => Promise<void>;

/**
 * Starts, confirms and refunds payments. Other modules register what should happen when a payment for
 * their purpose succeeds (for example, a food order is placed). Confirmation is idempotent, so the
 * browser return and the webhook arriving together do no harm.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly provider: PaymentProvider;
  private readonly handlers = new Map<string, Handler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    const env = loadEnv();
    if (env.PAYMENTS_PROVIDER === 'paystack') {
      if (!env.PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is required when PAYMENTS_PROVIDER is paystack');
      this.provider = new PaystackPaymentProvider(env.PAYSTACK_SECRET_KEY);
    } else {
      if (env.NODE_ENV === 'production') throw new Error('Use a real payment provider in production');
      this.provider = new DemoPaymentProvider(env.WEB_ORIGIN);
    }
  }

  get providerName() {
    return this.provider.name;
  }

  onSucceeded(purpose: string, handler: Handler) {
    this.handlers.set(purpose, handler);
  }

  async start(input: { purpose: string; userId: string; orderId?: string; amount: number; returnPath: string; description: string }) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true } });
    if (!user.email) throw new BadRequestException({ code: 'NO_EMAIL', message: 'Your account needs an email address to pay online.' });
    const reference = `ANU-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const payment = await this.prisma.payment.create({
      data: { reference, provider: this.provider.name, purpose: input.purpose, userId: input.userId, orderId: input.orderId, amount: input.amount },
    });
    const callbackUrl = `${loadEnv().WEB_ORIGIN}${input.returnPath}${input.returnPath.includes('?') ? '&' : '?'}reference=${reference}`;
    try {
      const { authorizationUrl } = await this.provider.initialize({ reference, amount: input.amount, email: user.email, callbackUrl, metadata: { purpose: input.purpose, description: input.description } });
      return { reference, authorizationUrl, provider: this.provider.name, paymentId: payment.id };
    } catch (err) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', providerData: { error: (err as Error).message } } });
      this.logger.error(`Payment start failed: ${(err as Error).message}`);
      throw new BadRequestException({ code: 'PAYMENT_UNAVAILABLE', message: 'Online payment is not available right now. Try again, or choose to pay at the counter.' });
    }
  }

  /** Asks the provider for the real outcome and applies it once. */
  async confirm(reference: string, forUserId?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payment not found.' });
    if (forUserId && payment.userId !== forUserId) throw new ForbiddenException({ code: 'NOT_YOURS', message: 'This payment is not yours.' });
    if (payment.status !== 'PENDING') return payment;

    const result = await this.provider.verify(reference, { amount: payment.amount, providerData: payment.providerData });
    if (result.status === 'pending') return payment;
    if (result.status === 'success' && (result.amount !== payment.amount || result.currency !== payment.currency)) {
      this.logger.error(`Payment ${reference}: amount or currency mismatch (${result.amount} ${result.currency})`);
      await this.audit.record({ action: 'payments.mismatch', module: 'payments', result: 'FAILURE', targetType: 'Payment', targetId: payment.id, metadata: { expected: payment.amount, got: result.amount } });
      return this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', providerData: { ...(payment.providerData as object), mismatch: result } } });
    }

    // Only the first confirmation changes the status, so handlers run exactly once.
    const updated = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: result.status === 'success' ? 'SUCCEEDED' : 'FAILED', channel: result.channel, paidAt: result.status === 'success' ? result.paidAt ?? new Date() : null },
    });
    const fresh = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (updated.count === 1) {
      await this.audit.record({ action: result.status === 'success' ? 'payments.succeeded' : 'payments.failed', module: 'payments', targetType: 'Payment', targetId: payment.id, actor: { id: payment.userId, label: 'Payment provider', roleKey: null }, metadata: { reference, amount: payment.amount, channel: result.channel } });
      if (result.status === 'success') {
        const handler = this.handlers.get(payment.purpose);
        if (handler) await handler({ id: payment.id, orderId: payment.orderId, userId: payment.userId, amount: payment.amount });
      }
    }
    return fresh;
  }

  async webhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !this.provider.verifyWebhook(rawBody, signature)) {
      await this.audit.record({ action: 'payments.webhook_rejected', module: 'payments', result: 'FAILURE' });
      throw new ForbiddenException({ code: 'BAD_SIGNATURE', message: 'Invalid signature.' });
    }
    const event = JSON.parse(rawBody.toString('utf8')) as { event: string; data?: { reference?: string; transaction_reference?: string } };
    if (event.event === 'charge.success' && event.data?.reference) await this.confirm(event.data.reference);
    if (event.event === 'refund.processed') {
      const ref = event.data?.transaction_reference;
      if (ref) await this.prisma.payment.updateMany({ where: { reference: ref, status: 'REFUND_PENDING' }, data: { status: 'REFUNDED', refundedAt: new Date() } });
    }
    return { received: true };
  }

  /** Demo provider only: the test checkout page reports the chosen outcome. */
  async demoComplete(reference: string, userId: string, outcome: 'success' | 'failed') {
    if (this.provider.name !== 'demo') throw new ForbiddenException({ code: 'NOT_DEMO', message: 'Test payments are switched off.' });
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment || payment.userId !== userId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payment not found.' });
    await this.prisma.payment.update({ where: { id: payment.id }, data: { providerData: { demoOutcome: outcome } } });
    return this.confirm(reference, userId);
  }

  async refund(paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'SUCCEEDED') return payment.status;
    try {
      const status = await this.provider.refund(payment.reference, payment.amount);
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status, refundedAt: status === 'REFUNDED' ? new Date() : null } });
      await this.audit.record({ action: 'payments.refund_started', module: 'payments', targetType: 'Payment', targetId: paymentId, metadata: { amount: payment.amount, reason, status } });
      return status;
    } catch (err) {
      // A failed refund must be seen by a person; it is logged and left SUCCEEDED for Finance to resolve.
      this.logger.error(`Refund failed for ${payment.reference}: ${(err as Error).message}`);
      await this.audit.record({ action: 'payments.refund_failed', module: 'payments', result: 'FAILURE', targetType: 'Payment', targetId: paymentId, metadata: { error: (err as Error).message } });
      return 'FAILED_TO_REFUND';
    }
  }
}
