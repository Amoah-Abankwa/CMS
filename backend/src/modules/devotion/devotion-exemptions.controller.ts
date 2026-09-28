import { BadRequestException, Body, Controller, Delete, Get, Injectable, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuditService } from '../audit/audit.service';

class ExemptDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)) @IsString() @MinLength(6) @MaxLength(20) indexNumber: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(5) @MaxLength(300) reason: string;
}

/**
 * Individual exemptions from morning devotion for the current semester, granted by the Chaplaincy.
 * Exempt students are not expected at services, and their course marks out of 95 are scaled to 100,
 * as for weekend students.
 */
@Injectable()
export class DevotionExemptionsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  private async semester() {
    const s = await this.prisma.semester.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!s) throw new BadRequestException({ code: 'NO_SEMESTER', message: 'There is no current semester.' });
    return s.id;
  }
  async list() {
    const semesterId = await this.semester();
    return this.prisma.devotionExemption.findMany({ where: { semesterId }, orderBy: { createdAt: 'desc' }, select: { reason: true, createdAt: true, student: { select: { id: true, firstName: true, lastName: true, indexNumber: true } } } });
  }
  async grant(user: AuthUser, dto: ExemptDto) {
    const semesterId = await this.semester();
    const st = await this.prisma.user.findUnique({ where: { indexNumber: dto.indexNumber }, select: { id: true, type: true } });
    if (!st || st.type !== 'STUDENT') throw new NotFoundException({ code: 'NOT_FOUND', message: 'No student has that index number.' });
    await this.prisma.devotionExemption.upsert({ where: { studentId_semesterId: { studentId: st.id, semesterId } }, create: { studentId: st.id, semesterId, reason: dto.reason, grantedById: user.id }, update: { reason: dto.reason, grantedById: user.id } });
    await this.audit.record({ action: 'devotion.exemption_granted', module: 'devotion', targetType: 'User', targetId: st.id, after: { reason: dto.reason } });
    return { ok: true };
  }
  async revoke(user: AuthUser, studentId: string) {
    const semesterId = await this.semester();
    await this.prisma.devotionExemption.deleteMany({ where: { studentId, semesterId } });
    await this.audit.record({ action: 'devotion.exemption_revoked', module: 'devotion', targetType: 'User', targetId: studentId });
    return { ok: true };
  }
}

@Controller('devotion/exemptions')
@RequirePermission(PERMISSIONS.DEVOTION_MANAGE)
export class DevotionExemptionsController {
  constructor(private readonly exemptions: DevotionExemptionsService) {}
  @Get() list() { return this.exemptions.list(); }
  @Post() grant(@CurrentUser() u: AuthUser, @Body() dto: ExemptDto) { return this.exemptions.grant(u, dto); }
  @Delete(':studentId') revoke(@CurrentUser() u: AuthUser, @Param('studentId', ParseUUIDPipe) id: string) { return this.exemptions.revoke(u, id); }
}
