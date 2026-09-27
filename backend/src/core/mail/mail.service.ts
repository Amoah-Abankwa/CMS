import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { loadEnv } from '../config/env';

export interface SendResult {
  providerMessageId?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly env = loadEnv();
  private readonly transporter: Transporter | null = this.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: this.env.SMTP_HOST,
        port: this.env.SMTP_PORT,
        secure: this.env.SMTP_PORT === 465,
        auth: { user: this.env.SMTP_USER, pass: this.env.SMTP_PASS },
      })
    : null;

  async send(to: string, subject: string, text: string): Promise<SendResult> {
    if (!this.transporter) {
      if (this.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
      this.logger.log(`[dev email] to=${to} subject="${subject}"\n${text}`);
      return { providerMessageId: 'dev-log' };
    }
    const info = await this.transporter.sendMail({ from: this.env.MAIL_FROM, to, subject, text });
    return { providerMessageId: info.messageId };
  }
}
