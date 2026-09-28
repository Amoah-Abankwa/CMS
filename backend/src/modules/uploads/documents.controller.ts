import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentsService, type DocPurpose } from './documents.service';

const PURPOSES = ['HOSTEL_FORM', 'HOSTEL_FORM_SUBMISSION', 'EXCUSE'];
class SignDto {
  @IsIn(PURPOSES) purpose: DocPurpose;
  @IsOptional() @IsString() @MaxLength(60) targetId?: string;
}
class RegisterDto extends SignDto {
  @IsString() @MaxLength(250) @Matches(/^[\w/-]+$/) publicId: string;
  @IsString() @MaxLength(10) format: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50_000_000) bytes?: number;
  @IsString() @MaxLength(200) originalName: string;
}

/** Private documents. Every call checks in the service that the person may upload or open the document. */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}
  @Post('sign') @HttpCode(200) sign(@CurrentUser() u: AuthUser, @Body() dto: SignDto) { return this.docs.sign(u, dto.purpose, dto.targetId); }
  @Post() register(@CurrentUser() u: AuthUser, @Body() dto: RegisterDto) { return this.docs.register(u, dto); }
  /** Redirects to a five-minute signed download link. */
  @Get(':id/download')
  async download(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, await this.docs.downloadUrl(u, id));
  }
}
