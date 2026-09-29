import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { PERMISSIONS, type IllStatus } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { LibraryExtrasService } from './library-extras.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
class IndexListDto { @Transform(({ value }) => (typeof value === 'string' ? value.split(/[\s,;]+/) : value)) @IsArray() @ArrayMaxSize(2000) @IsString({ each: true }) indexNumbers: string[]; }
class IssueDto { @Transform(trim) @IsString() @MinLength(6) @MaxLength(20) indexNumber: string; @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string; }
class EbookDto { @Transform(trim) @IsOptional() @IsString() @MaxLength(500) ebookUrl?: string | null; @IsOptional() @IsUUID() documentId?: string | null; }
class IllDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(200) title: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(200) authors?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(20) isbn?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120) lendingLibrary?: string;
  @IsOptional() @IsDateString() neededBy?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) note?: string;
}
class IllMoveDto { @IsIn(['ORDERED', 'ARRIVED', 'ON_LOAN', 'RETURNED', 'REJECTED']) status: IllStatus; @IsOptional() @IsDateString() dueDate?: string; @Transform(trim) @IsOptional() @IsString() @MaxLength(300) note?: string; }
class IllQuery { @IsOptional() @IsIn(['REQUESTED', 'ORDERED', 'ARRIVED', 'ON_LOAN', 'RETURNED', 'REJECTED', 'CANCELLED']) status?: string; }
class ItemDto {
  @IsOptional() @IsUUID() titleId?: string | null;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(400) citation?: string;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(500) url?: string;
  @IsIn(['ESSENTIAL', 'RECOMMENDED']) importance: 'ESSENTIAL' | 'RECOMMENDED';
  @Transform(trim) @IsOptional() @IsString() @MaxLength(200) note?: string;
}
class ListDto { @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => ItemDto) items: ItemDto[]; }

function sendPdf(res: Response, file: { filename: string; buffer: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/[^\w.-]/g, '-')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.buffer);
}

/** Library clearance, e-books, inter-library loans and reading lists. */
@Controller('library')
export class LibraryExtrasController {
  constructor(private readonly x: LibraryExtrasService) {}

  // Clearance: library staff issue; the library and the Registry check lists (checked in the service).
  @Post('clearance/check') @HttpCode(200) check(@CurrentUser() u: AuthUser, @Body() dto: IndexListDto) { return this.x.checkList(u, dto.indexNumbers); }
  @Post('clearance/issue') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE) issue(@CurrentUser() u: AuthUser, @Body() dto: IssueDto) { return this.x.issueCertificate(u, dto.indexNumber, dto.note); }
  @Get('clearance/:number/pdf') async certificate(@CurrentUser() u: AuthUser, @Param('number') n: string, @Res() res: Response) { sendPdf(res, await this.x.certificatePdf(u, n)); }

  // E-books
  @Put('titles/:id/ebook') @RequirePermission(PERMISSIONS.LIBRARY_MANAGE) ebook(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EbookDto) { return this.x.setEbook(u, id, dto); }
  @Get('titles/:id/read') async read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) { res.setHeader('Cache-Control', 'no-store'); res.redirect(302, await this.x.readEbook(u, id)); }

  // Inter-library loans: the library's side
  @Get('ill') @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE) ill(@Query() q: IllQuery) { return this.x.listIll(q.status); }
  @Post('ill/:id/move') @HttpCode(200) @RequirePermission(PERMISSIONS.LIBRARY_CIRCULATE) move(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IllMoveDto) { return this.x.moveIll(u, id, dto); }

  // Reading lists: lecturers of the course this semester and the Librarian edit (checked in the service); members read.
  @Get('reading-lists/editable') editable(@CurrentUser() u: AuthUser) { return this.x.editable(u); }
  @Get('reading-lists/demand') @RequirePermission(PERMISSIONS.LIBRARY_MANAGE) demand() { return this.x.demand(); }
  @Get('reading-lists/:courseId') list(@Param('courseId', ParseUUIDPipe) id: string) { return this.x.listFor(id); }
  @Put('reading-lists/:courseId') save(@CurrentUser() u: AuthUser, @Param('courseId', ParseUUIDPipe) id: string, @Body() dto: ListDto) { return this.x.save(u, id, dto.items); }
}

@Controller('me/library')
export class MyLibraryExtrasController {
  constructor(private readonly x: LibraryExtrasService) {}
  @Get('clearance') clearance(@CurrentUser() u: AuthUser) { return this.x.myClearance(u); }
  @Get('reading-lists') lists(@CurrentUser() u: AuthUser) { return this.x.myLists(u); }
  @Get('ill') ill(@CurrentUser() u: AuthUser) { return this.x.mineIll(u); }
  @Post('ill') requestIll(@CurrentUser() u: AuthUser, @Body() dto: IllDto) { return this.x.requestIll(u, dto); }
  @Post('ill/:id/cancel') @HttpCode(200) cancelIll(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.x.cancelIll(u, id); }
}
