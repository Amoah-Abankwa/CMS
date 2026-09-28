import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { loadEnv } from '../config/env';

export interface SendResult {
  providerMessageId?: string;
}

/**
 * Sends email through Resend (EMAIL_PROVIDER=resend) or SMTP. With neither configured, development
 * logs the message instead; production refuses to start without email (see production-checks.ts).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly env = loadEnv();
  private readonly transporter: Transporter | null = this.env.EMAIL_PROVIDER === 'smtp' && this.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: this.env.SMTP_HOST,
        port: this.env.SMTP_PORT,
        secure: this.env.SMTP_PORT === 465,
        auth: { user: this.env.SMTP_USER, pass: this.env.SMTP_PASS },
      })
    : null;

  async send(to: string, subject: string, text: string): Promise<SendResult> {
    if (this.env.EMAIL_PROVIDER === 'resend' && this.env.RESEND_API_KEY) return this.sendResend(to, subject, text);
    if (!this.transporter) {
      if (this.env.NODE_ENV === 'production') throw new Error('Email is not configured');
      this.logger.log(`[dev email] to=${to} subject="${subject}"\n${text}`);
      return { providerMessageId: 'dev-log' };
    }
    const info = await this.transporter.sendMail({ from: this.env.MAIL_FROM, to, subject, text });
    return { providerMessageId: info.messageId };
  }

  /** https://resend.com/docs/api-reference/emails/send-email */
  private async sendResend(to: string, subject: string, text: string): Promise<SendResult> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.env.MAIL_FROM, to: [to], subject, text }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    // A failure is thrown so the notification is marked failed and appears on the Failed messages screen for resending.
    if (!res.ok || !body.id) throw new Error(`Resend: ${body.message ?? body.name ?? res.statusText}`);
    return { providerMessageId: body.id };
  }
}
