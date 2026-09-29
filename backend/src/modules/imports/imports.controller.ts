import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsString, Max, MaxLength, Min } from 'class-validator';
import type { ImportType } from '@anu/shared';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireRecentMfa } from '../../common/decorators/require-recent-mfa.decorator';
import { ImportsService } from './imports.service';

const TYPES = ['STRUCTURE', 'COURSES', 'STAFF', 'STUDENTS', 'RESULTS'];
class StartDto {
  @IsIn(TYPES) type: ImportType;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(200) fileName: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000) totalRows: number;
}
class RowsDto {
  @IsArray() @ArrayMaxSize(200) @IsObject({ each: true }) rows: Record<string, string>[];
  @Type(() => Number) @IsInt() @Min(2) startRow: number;
  @IsBoolean() commit: boolean;
}

/** Importing from the previous system. The permission for each kind of record is checked in the service. */
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.imports.list(u); }
  @Post() @RequireRecentMfa() start(@CurrentUser() u: AuthUser, @Body() dto: StartDto) { return this.imports.start(u, dto); }
  @Post(':id/rows') @HttpCode(200) rows(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RowsDto) { return this.imports.rows(u, id, dto.rows, dto.startRow, dto.commit); }
  @Post(':id/finish') @HttpCode(200) finish(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.imports.finish(u, id); }
  @Post(':id/setup-links') @HttpCode(200) @RequireRecentMfa() setup(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.imports.sendSetupLinks(u, id); }
}
