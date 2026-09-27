import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { validateScale } from './grading';
import { SaveScaleDto } from './dto/results.dto';

const SCALE_SELECT = {
  id: true, version: true, name: true, passMark: true, maxGradePoint: true, createdAt: true,
  bands: { orderBy: { minScore: 'desc' }, select: { letter: true, minScore: true, gradePoint: true, isPass: true, remark: true } },
} as const;

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async active() {
    const scale = await this.prisma.gradingScale.findFirst({ where: { isActive: true }, select: SCALE_SELECT });
    if (!scale) throw new NotFoundException({ code: 'NO_SCALE', message: 'No grading scale is set. Ask the Registry to set one.' });
    return scale;
  }

  /** Saves a new version and makes it active. Older versions stay attached to the results graded with them. */
  async save(user: AuthUser, dto: SaveScaleDto) {
    const bands = dto.bands.map((b) => ({ ...b, letter: b.letter.trim().toUpperCase(), remark: b.remark?.trim() || null }));
    const problems = validateScale(bands, dto.passMark, dto.maxGradePoint);
    if (problems.length) throw new BadRequestException({ code: 'SCALE_INVALID', message: problems[0], details: problems });

    const before = await this.prisma.gradingScale.findFirst({ where: { isActive: true }, select: SCALE_SELECT });
    const latest = await this.prisma.gradingScale.aggregate({ _max: { version: true } });
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.gradingScale.updateMany({ where: { isActive: true }, data: { isActive: false } });
      return tx.gradingScale.create({
        data: {
          version: (latest._max.version ?? 0) + 1,
          name: dto.name.trim(),
          passMark: dto.passMark,
          maxGradePoint: dto.maxGradePoint,
          isActive: true,
          createdById: user.id,
          bands: { create: bands },
        },
        select: SCALE_SELECT,
      });
    });
    await this.audit.record({ action: 'grading.scale_saved', module: 'results', targetType: 'GradingScale', targetId: created.id, before, after: created });
    return created;
  }
}
