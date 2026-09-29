import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IsIn } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { TransfersService, type TransferPurpose } from './transfers.service';
import { RequireRecentMfa } from '../../common/decorators/require-recent-mfa.decorator';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

class TransferDto {
  @IsIn(['VENDOR', 'DISPATCHER', 'ASSOCIATION', 'HOSTEL_OWNER', 'PAYROLL']) purpose: TransferPurpose;
  @IsUUID() subjectId: string;
  @Type(() => Number) @IsInt() @Min(100) @Max(100_000_000) amount: number;
  @IsOptional() @IsDateString() periodFrom?: string;
  @IsOptional() @IsDateString() periodTo?: string;
}
class TransferQuery { @IsIn(['VENDOR', 'DISPATCHER', 'ASSOCIATION', 'HOSTEL_OWNER', 'PAYROLL']) purpose: TransferPurpose; }

class DemoOutcomeDto {
  @IsIn(['success', 'failed']) outcome: 'success' | 'failed';
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService, private readonly transfers: TransfersService) {}

  /** Finance sends a payout through Paystack Transfers. Permission is checked in the service per kind of payout. */
  @Post('transfers') @RequireRecentMfa()
  transfer(@CurrentUser() u: AuthUser, @Body() dto: TransferDto) { return this.transfers.send(u, dto); }

  @Get('transfers')
  transferList(@CurrentUser() u: AuthUser, @Query() q: TransferQuery) { return this.transfers.list(u, q.purpose); }

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
