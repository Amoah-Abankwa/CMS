import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { HostelFormsService } from './hostel-forms.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class TemplateDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(100) title: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsUUID() hostelId?: string | null;
  @IsUUID() documentId: string;
}
class ActiveDto { @IsBoolean() isActive: boolean; }
class SubmitDto { @IsUUID() documentId: string; }
class ReviewDto { @IsBoolean() accept: boolean; @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string; }
class CheckDto { @IsIn(['in', 'out']) action: 'in' | 'out'; @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string; }

/** Hostel forms and residents. Who may act (student, Hostel Manager, owner) is checked in the service. */
@Controller('hostel-forms')
export class HostelFormsController {
  constructor(private readonly forms: HostelFormsService) {}
  @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.forms.mine(u); }
  @Post(':templateId/submit') submit(@CurrentUser() u: AuthUser, @Param('templateId', ParseUUIDPipe) id: string, @Body() dto: SubmitDto) { return this.forms.submit(u, id, dto.documentId); }
  @Get('templates') templates(@CurrentUser() u: AuthUser) { return this.forms.templates(u); }
  @Post('templates') create(@CurrentUser() u: AuthUser, @Body() dto: TemplateDto) { return this.forms.createTemplate(u, dto); }
  @Post('templates/:id/active') @HttpCode(200) active(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActiveDto) { return this.forms.setTemplateActive(u, id, dto.isActive); }
  @Post('submissions/:id/review') @HttpCode(200) review(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) { return this.forms.review(u, id, dto.accept, dto.note); }
  @Get('residents') residents(@CurrentUser() u: AuthUser) { return this.forms.residents(u); }
  @Post('residents/:kind/:id/check') @HttpCode(200) check(@CurrentUser() u: AuthUser, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckDto) {
    return this.forms.check(u, kind === 'booking' ? 'booking' : 'allocation', id, dto.action, dto.note);
  }
}
