import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
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
