import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IsIn } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

class DemoOutcomeDto {
  @IsIn(['success', 'failed']) outcome: 'success' | 'failed';
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Called by Paystack. Authenticated by the HMAC signature, not a session. */
  @Public() @HttpCode(200)
  @Post('paystack/webhook')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature?: string) {
    return this.payments.webhook(req.rawBody, signature);
  }

  @Get('provider')
  provider() {
    return { provider: this.payments.providerName };
  }

  /** The customer returns from checkout; confirm with the provider before trusting it. */
  @Get(':reference/verify')
  async verify(@CurrentUser() u: AuthUser, @Param('reference') reference: string) {
    const p = await this.payments.confirm(reference, u.id);
    return { status: p.status, orderId: p.orderId, amount: p.amount, purpose: p.purpose };
  }

  @Post(':reference/demo') @HttpCode(200)
  async demo(@CurrentUser() u: AuthUser, @Param('reference') reference: string, @Body() dto: DemoOutcomeDto) {
    const p = await this.payments.demoComplete(reference, u.id, dto.outcome);
    return { status: p.status, orderId: p.orderId };
  }
}
