import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PermissionResolverService } from '../rbac/permission-resolver.service';

/** Sends a generated PDF as a download. */
function sendPdf(res: Response, file: { filename: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/[^\w.-]/g, '-')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.buffer);
}
import { PERMISSIONS } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { FeeRulesService } from './fee-rules.service';
import { FeesService } from './fees.service';
import { DuesService } from './dues.service';
import { HallChargesService } from './hall-charges.service';
import {
  AdjustmentDto, AssociationDto, BillsQuery, ClearanceRuleDto, ExchangeRateDto, FeeItemDto, CashDto, CopySchedulesDto, DuesPayoutDto, FeeRulesDto, LevyDto, LevyOpenDto, OfficerDto, PayFeesDto, ReasonDto, RecordFeePaymentDto, ScheduleDto, SemesterBody,
} from './dto/fees.dto';

/** Finance Office: schedules, bills, payments, clearance rule, and paying associations their online dues. */
@Controller('fees')
@RequirePermission(PERMISSIONS.FEES_MANAGE)
export class FeesAdminController {
  constructor(private readonly rules: FeeRulesService, private readonly fees: FeesService, private readonly dues: DuesService, private readonly hall: HallChargesService) {}

  @Get('options') options() { return this.fees.options(); }
  @Get('rules') getRules() { return this.rules.get(); }

  @Put('rules')
  async setRules(@Body() dto: FeeRulesDto) {
    return (await this.rules.setFinance(dto)).after;
  }

  @Get('rates') rates() { return this.fees.rates(); }
  @Post('rates') addRate(@CurrentUser() u: AuthUser, @Body() dto: ExchangeRateDto) { return this.fees.addRate(u, dto); }
  @Delete('rates/:id') deleteRate(@Param('id', ParseUUIDPipe) id: string) { return this.fees.deleteRate(id); }
  @Get('items') items() { return this.fees.items(); }
  @Post('items') createItem(@Body() dto: FeeItemDto) { return this.fees.saveItem(dto); }
  @Put('items/:id') updateItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FeeItemDto) { return this.fees.saveItem(dto, id); }

  @Get('schedules') schedules(@Query() q: SemesterBody) { return this.fees.schedules(q.semesterId); }
  @Post('schedules') createSchedule(@CurrentUser() u: AuthUser, @Body() dto: ScheduleDto) { return this.fees.saveSchedule(u, dto); }
  @Put('schedules/:id') updateSchedule(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleDto) { return this.fees.saveSchedule(u, dto, id); }
  @Delete('schedules/:id') deleteSchedule(@Param('id', ParseUUIDPipe) id: string) { return this.fees.deleteSchedule(id); }
  @Post('schedules/copy') copy(@CurrentUser() u: AuthUser, @Body() dto: CopySchedulesDto) { return this.fees.copySchedules(u, dto); }

  @Post('bills/issue') @HttpCode(200)
  async issue(@CurrentUser() u: AuthUser, @Body() dto: SemesterBody) {
    const r = await this.fees.issueBills(u, dto.semesterId);
    // Students who accepted a hall place before bills existed get their hall fee now.
    await this.hall.syncSemester(dto.semesterId, u.id);
    return r;
  }
  @Get('bills') bills(@Query() q: BillsQuery) { return this.fees.bills(q); }
  @Get('bills/:id') bill(@Param('id', ParseUUIDPipe) id: string) { return this.fees.bill(id); }
  @Post('bills/:id/payments') pay(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordFeePaymentDto) { return this.fees.recordPayment(u, id, dto); }
  @Post('bills/:id/adjustments') adjust(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustmentDto) { return this.fees.adjust(u, id, dto); }
  @Get('payments/:id/receipt/pdf') async adminReceiptPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { sendPdf(res, await this.fees.receiptPdf(id)); }
  @Get('bills/:id/statement/pdf') async adminStatementPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { sendPdf(res, await this.fees.statementPdf(id)); }
  @Get('payments/:id/receipt') adminReceipt(@Param('id', ParseUUIDPipe) id: string) { return this.fees.receipt(id); }
  @Post('payments/:id/reverse') @HttpCode(200) reverse(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) { return this.fees.reverse(u, id, dto.reason); }

  @Get('dues-settlements') duesSettlements() { return this.dues.settlements(); }
  @Post('dues-payouts') duesPayout(@CurrentUser() u: AuthUser, @Body() dto: DuesPayoutDto) { return this.dues.recordPayout(u, dto); }
}

/** The Registrar's office sets how much of the fees must be paid to be cleared for exams. */
@Controller('fees/clearance-rule')
@RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
export class ClearanceRuleController {
  constructor(private readonly rules: FeeRulesService, private readonly fees: FeesService) {}
  @Get() async get() { return { clearancePercent: (await this.rules.get()).clearancePercent }; }
  @Put()
  async set(@CurrentUser() u: AuthUser, @Body() dto: ClearanceRuleDto) {
    const { before, after } = await this.rules.setClearance(dto.clearancePercent);
    const rechecked = before.clearancePercent !== after.clearancePercent ? await this.fees.reapplyRule(u.id) : 0;
    return { clearancePercent: after.clearancePercent, rechecked };
  }
}

@Controller('me/fees')
export class MyFeesController {
  constructor(private readonly fees: FeesService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.fees.mine(u); }
  @Get('receipts/:id') receipt(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.fees.receipt(id, u); }
  @Get('receipts/:id/pdf') async receiptPdf(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { sendPdf(res, await this.fees.receiptPdf(id, u)); }
  @Get('statements/:billId/pdf') async statementPdf(@CurrentUser() u: AuthUser, @Param('billId', ParseUUIDPipe) id: string, @Res() res: Response) { sendPdf(res, await this.fees.statementPdf(id, u)); }
  @Post('pay') @HttpCode(200) pay(@CurrentUser() u: AuthUser, @Body() dto: PayFeesDto) { return this.fees.payOnline(u, dto.billId, dto.amount); }
}

/** Dean of Students office: associations, their elected officers, and cancelling receipts. */
@Controller('associations')
@RequirePermission(PERMISSIONS.ASSOCIATIONS_MANAGE)
export class AssociationsAdminController {
  constructor(private readonly dues: DuesService) {}
  @Get() list() { return this.dues.associations(); }
  @Get('departments') departments() { return this.dues.departments(); }
  @Post() create(@Body() dto: AssociationDto) { return this.dues.saveAssociation(dto); }
  @Put(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssociationDto) { return this.dues.saveAssociation(dto, id); }
  @Post(':id/officers') appoint(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OfficerDto) { return this.dues.appoint(u, id, dto); }
  @Post('officers/:id/end') @HttpCode(200) end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) { return this.dues.endTerm(id, dto.reason); }
  @Get(':id/receipts') receipts(@Param('id', ParseUUIDPipe) id: string) { return this.dues.receipts(id); }
  @Post('receipts/:id/void') @HttpCode(200) void(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) { return this.dues.voidPayment(u, id, dto.reason); }
}

/** Elected association officers. */
@Controller('association')
@RequirePermission(PERMISSIONS.DUES_COLLECT)
export class OfficerController {
  constructor(private readonly dues: DuesService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.dues.myOffices(u); }
  @Post(':associationId/levies') levy(@CurrentUser() u: AuthUser, @Param('associationId', ParseUUIDPipe) id: string, @Body() dto: LevyDto) { return this.dues.createLevy(u, id, dto); }
  @Post('levies/:id/open') @HttpCode(200) open(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LevyOpenDto) { return this.dues.setLevyOpen(u, id, dto.isOpen); }
  @Get('levies/:id') members(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.dues.levyMembers(u, id); }
  @Post('levies/:id/cash') cash(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CashDto) { return this.dues.recordCash(u, id, dto.indexNumber); }
}

@Controller('me/dues')
export class MyDuesController {
  constructor(private readonly dues: DuesService, private readonly resolver: PermissionResolverService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.dues.mine(u); }
  @Get('receipts/:id/pdf')
  async receiptPdf(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const isDean = (await this.resolver.permissionsFor(u.id, u.activeRoleKey)).has(PERMISSIONS.ASSOCIATIONS_MANAGE);
    sendPdf(res, await this.dues.receiptPdf(u, id, isDean));
  }
  @Post('levies/:id/pay') @HttpCode(200) pay(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.dues.payOnline(u, id); }
}
