import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../config/env';
import type { SmsProvider } from './sms.provider';

class LogSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');
  async send(to: string, message: string) {
    this.logger.log(`[dev sms] to=${to} "${message}"`);
    return { providerMessageId: 'dev-log' };
  }
}

class ArkeselSmsProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly sender: string,
  ) {}

  async send(to: string, message: string) {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: this.sender, message, recipients: [to] }),
    });
    const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string; data?: Array<{ id?: string }> };
    if (!res.ok || body.status !== 'success') {
      throw new Error(`Arkesel rejected the message: ${body.message ?? res.status}`);
    }
    return { providerMessageId: body.data?.[0]?.id };
  }
}

@Injectable()
export class SmsService implements SmsProvider {
  private readonly provider: SmsProvider;

  constructor() {
    const env = loadEnv();
    if (env.SMS_PROVIDER === 'arkesel') {
      if (!env.SMS_API_KEY) throw new Error('SMS_API_KEY is required for the Arkesel provider');
      this.provider = new ArkeselSmsProvider(env.SMS_API_KEY, env.SMS_SENDER_ID);
    } else {
      if (env.NODE_ENV === 'production') throw new Error('Configure a real SMS provider in production');
      this.provider = new LogSmsProvider();
    }
  }

  send(to: string, message: string) {
    return this.provider.send(to, message);
  }
}
