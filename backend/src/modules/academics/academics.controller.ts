import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SemestersService } from './semesters.service';

class UpdateSemesterDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() registrationOpensAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() registrationClosesAt?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(40) minCredits?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(40) maxCredits?: number;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
}

class YearDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(9) label: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}
class YearDatesDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}
class NewSemesterDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(3) number: number;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(40) minCredits?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(40) maxCredits?: number;
}

@Controller('academics')
@RequirePermission(PERMISSIONS.ACADEMICS_READ)
export class AcademicsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
  ) {}

  @Get('semesters')
  listSemesters() {
    return this.semesters.list();
  }

  @Patch('semesters/:id')
  @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  updateSemester(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSemesterDto) {
    return this.semesters.update(id, dto);
  }

  @Get('years')
  @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  years() {
    return this.semesters.years();
  }

  @Post('years')
  @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  createYear(@Body() dto: YearDto) {
    return this.semesters.createYear(dto);
  }

  @Patch('years/:id')
  @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  updateYear(@Param('id', ParseUUIDPipe) id: string, @Body() dto: YearDatesDto) {
    return this.semesters.updateYear(id, dto);
  }

  @Delete('years/:id')
  @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  deleteYear(@Param('id', ParseUUIDPipe) id: string) {
    return this.semesters.deleteYear(id);
  }

  @Post('years/:id/semesters')
  @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  createSemester(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NewSemesterDto) {
    return this.semesters.createSemester(id, dto);
  }

  @Delete('semesters/:id')
  @RequirePermission(PERMISSIONS.ACADEMICS_MANAGE)
  deleteSemester(@Param('id', ParseUUIDPipe) id: string) {
    return this.semesters.deleteSemester(id);
  }

  @Get('programmes')
  programmes() {
    return this.prisma.programme.findMany({
      where: { isActive: true },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true, code: true, name: true, levelCode: true, durationYears: true,
        level: { select: { name: true } },
        department: { select: { name: true, school: { select: { name: true } } } },
      },
    });
  }

  @Get('programme-levels')
  levels() {
    return this.prisma.programmeLevel.findMany({ orderBy: { code: 'asc' } });
  }

  @Get('structure')
  structure() {
    return this.prisma.school.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, code: true, name: true,
        departments: {
          orderBy: { name: 'asc' },
          select: { id: true, code: true, name: true, _count: { select: { programmes: true, courses: true } } },
        },
      },
    });
  }
}
