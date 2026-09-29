import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { HostelFeesService } from './hostel-fees.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class PayDto { @Type(() => Number) @IsInt() @Min(100) @Max(100_000_000) amount: number; }
class RecordDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) amount: number;
  @IsIn(['CASH', 'MOBILE_MONEY', 'BANK']) method: 'CASH' | 'MOBILE_MONEY' | 'BANK';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @IsDateString() paidOn: string;
}
class ReasonDto { @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) reason: string; }
class ListQuery {
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) search?: string;
  @Transform(({ value }) => value === 'true' || value === true) @IsOptional() @IsBoolean() unpaidOnly?: boolean;
}
class PayoutDetailsDto {
  @IsUUID() hostelId: string;
  @IsIn(['MTN', 'Telecel', 'AirtelTigo']) network: string;
  @Transform(trim) @IsString() @MinLength(9) @MaxLength(15) number: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) name: string;
}
class PayoutDto {
  @IsUUID() hostelId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) amount: number;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(60) reference?: string;
}

function sendPdf(res: Response, file: { filename: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/[^\w.-]/g, '-')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.buffer);
}

/** Students' own hostel fees; the Hostel Manager's and owners' lists. Who may act is checked in the service. */
@Controller('hostel-fees')
export class HostelFeesController {
  constructor(private readonly fees: HostelFeesService) {}
  @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.fees.mine(u); }
  @Post(':id/pay') @HttpCode(200) pay(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayDto) { return this.fees.payOnline(u, id, dto.amount); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) { return this.fees.list(u, q); }
  @Post(':id/payments') record(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordDto) { return this.fees.record(u, id, dto); }
  @Post('payments/:id/reverse') @HttpCode(200) reverse(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) { return this.fees.reverse(u, id, dto.reason); }
  @Post('payout-details') @HttpCode(200) payoutDetails(@CurrentUser() u: AuthUser, @Body() dto: PayoutDetailsDto) { return this.fees.setPayoutDetails(u, dto); }
  @Get('payments/:id/pdf') async pdf(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { sendPdf(res, await this.fees.receiptPdf(u, id)); }
}

@Controller('fees/hostel-owners')
@RequirePermission(PERMISSIONS.FEES_MANAGE)
export class HostelOwnerPayoutsController {
  constructor(private readonly fees: HostelFeesService) {}
  @Get() settlements() { return this.fees.ownerSettlements(); }
  @Post('payouts') payout(@CurrentUser() u: AuthUser, @Body() dto: PayoutDto) { return this.fees.recordOwnerPayout(u, dto); }
}
