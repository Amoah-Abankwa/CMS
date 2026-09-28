import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { canDecide, checkEligibility, formatCedis, PAY_UNIT_LABEL, type ApplicationStatus } from '@anu/shared';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EVENT_KEYS } from '../notifications/templates';
import { EligibilityService } from './eligibility.service';
import { EmploymentRulesService } from './employment-rules.service';
import { ApplyDto, DecisionDto, JobDto } from './dto/employment.dto';

const JOB_PUBLIC = {
  id: true, title: true, unit: true, description: true, hoursPerWeek: true, payRate: true, payUnit: true, positions: true, minCgpa: true, closesAt: true, status: true,
} satisfies Prisma.JobSelect;

const dateLabel = (d: Date) => d.toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'long', year: 'numeric' });

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: EligibilityService,
    private readonly rules: EmploymentRulesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ----- Career Services -----

  async list() {
    const jobs = await this.prisma.job.findMany({
      orderBy: [{ status: 'asc' }, { closesAt: 'asc' }],
      select: { ...JOB_PUBLIC, supervisor: { select: { firstName: true, lastName: true, email: true } }, applications: { select: { status: true } } },
    });
    return jobs.map(({ applications, ...j }) => ({
      ...j,
      applicants: applications.filter((a) => a.status !== 'WITHDRAWN').length,
      waiting: applications.filter((a) => a.status === 'SUBMITTED').length,
      hired: applications.filter((a) => a.status === 'HIRED').length,
    }));
  }

  private async supervisorId(email?: string) {
    if (!email) return null;
    const staff = await this.prisma.user.findFirst({ where: { email, type: 'STAFF', status: 'ACTIVE' }, select: { id: true } });
    if (!staff) throw new BadRequestException({ code: 'SUPERVISOR', message: 'No active staff member has that email.' });
    return staff.id;
  }

  async save(user: AuthUser, dto: JobDto, id?: string) {
    const closesAt = new Date(dto.closesAt);
    if (!id && closesAt <= new Date()) throw new BadRequestException({ code: 'CLOSES', message: 'The closing date must be in the future.' });
    const { supervisorEmail, ...rest } = dto;
    const data = { ...rest, minCgpa: dto.minCgpa ?? null, closesAt, supervisorId: await this.supervisorId(supervisorEmail) };
    const job = id ? await this.prisma.job.update({ where: { id }, data }) : await this.prisma.job.create({ data: { ...data, createdById: user.id } });
    await this.audit.record({ action: id ? 'employment.job_updated' : 'employment.job_created', module: 'employment', targetType: 'Job', targetId: job.id, after: { title: job.title, unit: job.unit, pay: `${formatCedis(job.payRate)} ${PAY_UNIT_LABEL[job.payUnit]}` } });
    return job;
  }

  async setStatus(id: string, status: 'DRAFT' | 'OPEN' | 'CLOSED') {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found.' });
    if (status === 'OPEN' && job.closesAt <= new Date()) throw new BadRequestException({ code: 'CLOSES', message: 'Move the closing date forward before opening it.' });
    const updated = await this.prisma.job.update({ where: { id }, data: { status } });
    await this.audit.record({ action: 'employment.job_status', module: 'employment', targetType: 'Job', targetId: id, before: { status: job.status }, after: { status } });
    return updated;
  }

  /** A job with its applicants, each checked against the rules as they stand today. */
  async detail(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: {
        ...JOB_PUBLIC,
        supervisor: { select: { firstName: true, lastName: true, email: true } },
        applications: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, status: true, statement: true, availability: true, cgpaAtApply: true, decisionNote: true, decidedAt: true, startedAt: true, endedAt: true, createdAt: true,
            student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, email: true, phone: true, studentProfile: { select: { currentLevel: true, programme: { select: { name: true } } } } } },
          },
        },
      },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found.' });
    const [standing, rules] = await Promise.all([this.eligibility.standing(job.applications.map((a) => a.student.id)), this.rules.get()]);
    return {
      ...job,
      applications: job.applications.map((a) => {
        const s = standing.get(a.student.id)!;
        // A student already hired here should not be counted against themselves.
        const jobs = a.status === 'HIRED' ? s.currentJobs - 1 : s.currentJobs;
        return { ...a, cgpa: s.cgpa, eligibility: checkEligibility({ ...s, currentJobs: jobs }, rules, { jobMinCgpa: job.minCgpa, forJob: a.status !== 'HIRED' }) };
      }),
    };
  }

  async decide(user: AuthUser, applicationId: string, dto: DecisionDto) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { job: true, student: { select: { id: true, firstName: true, lastName: true, indexNumber: true, phone: true } } },
    });
    if (!app) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Application not found.' });
    if (!canDecide(app.status as ApplicationStatus, dto.status)) {
      throw new ConflictException({ code: 'NOT_ALLOWED', message: `An application that is ${app.status.toLowerCase()} cannot be ${dto.status.toLowerCase()}.` });
    }
    if ((dto.status === 'REJECTED' || dto.status === 'ENDED') && !dto.note) throw new BadRequestException({ code: 'REASON', message: 'Give a reason. The student sees it.' });

    const now = new Date();
    const start = dto.startDate ? new Date(dto.startDate) : now;
    if (dto.status === 'HIRED') {
      const elig = await this.eligibility.check(app.studentId, { jobMinCgpa: app.job.minCgpa, forJob: true });
      if (!elig.eligible) throw new ConflictException({ code: 'NOT_ELIGIBLE', message: `This student cannot be hired: ${elig.reasons.join(' ')}` });
    }

    // Hiring is checked against the number of places inside the transaction, so two officers cannot overfill a job.
    await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'HIRED') {
        const hired = await tx.jobApplication.count({ where: { jobId: app.jobId, status: 'HIRED' } });
        if (hired >= app.job.positions) throw new ConflictException({ code: 'FULL', message: `All ${app.job.positions} places are filled. End someone's job first or add places.` });
      }
      const moved = await tx.jobApplication.updateMany({
        where: { id: app.id, status: app.status },
        data: {
          status: dto.status, decisionNote: dto.note || null, decidedById: user.id, decidedAt: now,
          ...(dto.status === 'HIRED' ? { startedAt: start } : {}), ...(dto.status === 'ENDED' ? { endedAt: now } : {}),
        },
      });
      if (moved.count !== 1) throw new ConflictException({ code: 'CHANGED', message: 'This application was just updated. Refresh.' });
    });
    await this.audit.record({ action: `employment.application_${dto.status.toLowerCase()}`, module: 'employment', targetType: 'JobApplication', targetId: app.id, before: { status: app.status }, after: { status: dto.status, note: dto.note }, metadata: { job: app.job.title, student: app.student.indexNumber } });

    const messages: Record<DecisionDto['status'], [string, string]> = {
      SHORTLISTED: ['you have been shortlisted', 'Career Services will contact you about the next step.'],
      HIRED: ['you have been hired', `You start on ${dateLabel(start)}, for about ${app.job.hoursPerWeek} hours a week, paid ${formatCedis(app.job.payRate)} ${PAY_UNIT_LABEL[app.job.payUnit]}.${dto.note ? ` ${dto.note}` : ''}`],
      REJECTED: ['not successful this time', dto.note ?? ''],
      ENDED: ['your job has ended', dto.note ?? ''],
    };
    const [headline, detail] = messages[dto.status];
    await this.notifications.notify({
      eventKey: EVENT_KEYS.JOB_APPLICATION_UPDATE,
      recipients: [{ userId: app.studentId }],
      channels: dto.status === 'HIRED' || dto.status === 'ENDED' ? ['IN_APP', 'EMAIL', 'SMS'] : ['IN_APP', 'EMAIL'],
      sharedVars: { job: app.job.title, unit: app.job.unit, headline, detail },
      link: '/jobs',
    });
    if (dto.status === 'HIRED' && app.job.supervisorId) {
      await this.notifications.notify({
        eventKey: EVENT_KEYS.JOB_HIRE_SUPERVISOR,
        recipients: [{ userId: app.job.supervisorId }],
        channels: ['IN_APP', 'EMAIL'],
        sharedVars: { student: `${app.student.firstName} ${app.student.lastName}`, indexNumber: app.student.indexNumber ?? '', job: app.job.title, start: dateLabel(start), hours: app.job.hoursPerWeek, phone: app.student.phone ?? 'not given' },
      });
    }
    return { ok: true };
  }

  /** Runs daily: jobs past their closing date stop taking applications. */
  async closeExpired() {
    const r = await this.prisma.job.updateMany({ where: { status: 'OPEN', closesAt: { lt: new Date() } }, data: { status: 'CLOSED' } });
    return r.count;
  }

  // ----- Students -----

  private assertStudent(user: AuthUser) {
    if (user.type !== 'STUDENT') throw new ForbiddenException({ code: 'STUDENTS_ONLY', message: 'Campus jobs are for students.' });
  }

  async openJobs(user: AuthUser) {
    this.assertStudent(user);
    const [jobs, mine, standing, rules] = await Promise.all([
      this.prisma.job.findMany({ where: { status: 'OPEN', closesAt: { gt: new Date() } }, orderBy: { closesAt: 'asc' }, select: JOB_PUBLIC }),
      this.myApplications(user),
      this.eligibility.standing([user.id]).then((m) => m.get(user.id)!),
      this.rules.get(),
    ]);
    const applied = new Map(mine.map((a) => [a.job.id, a.status]));
    return {
      standing: { cgpa: standing.cgpa, eligibility: checkEligibility(standing, rules, { forJob: true }), minCgpa: rules.minCgpa },
      jobs: jobs.map((j) => ({ ...j, myStatus: applied.get(j.id) ?? null, eligibility: checkEligibility(standing, rules, { jobMinCgpa: j.minCgpa, forJob: true }) })),
      applications: mine,
    };
  }

  myApplications(user: AuthUser) {
    return this.prisma.jobApplication.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, decisionNote: true, startedAt: true, endedAt: true, createdAt: true, job: { select: { id: true, title: true, unit: true, hoursPerWeek: true, payRate: true, payUnit: true } } },
    });
  }

  async job(user: AuthUser, id: string) {
    this.assertStudent(user);
    const job = await this.prisma.job.findFirst({ where: { id, status: { in: ['OPEN', 'CLOSED'] } }, select: { ...JOB_PUBLIC, supervisor: { select: { firstName: true, lastName: true } } } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found.' });
    const [elig, mine] = await Promise.all([
      this.eligibility.check(user.id, { jobMinCgpa: job.minCgpa, forJob: true }),
      this.prisma.jobApplication.findUnique({ where: { jobId_studentId: { jobId: id, studentId: user.id } }, select: { id: true, status: true, decisionNote: true } }),
    ]);
    return { ...job, eligibility: elig, myApplication: mine };
  }

  async apply(user: AuthUser, jobId: string, dto: ApplyDto) {
    this.assertStudent(user);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'OPEN' || job.closesAt <= new Date()) throw new ConflictException({ code: 'CLOSED', message: 'This job is not taking applications.' });
    const elig = await this.eligibility.check(user.id, { jobMinCgpa: job.minCgpa, forJob: true });
    if (!elig.eligible) throw new ForbiddenException({ code: 'NOT_ELIGIBLE', message: elig.reasons.join(' ') });
    const existing = await this.prisma.jobApplication.findUnique({ where: { jobId_studentId: { jobId, studentId: user.id } } });
    if (existing && existing.status !== 'WITHDRAWN') throw new ConflictException({ code: 'APPLIED', message: 'You have already applied for this job.' });
    const app = existing
      ? await this.prisma.jobApplication.update({ where: { id: existing.id }, data: { status: 'SUBMITTED', statement: dto.statement, availability: dto.availability || null, cgpaAtApply: elig.cgpa, decisionNote: null, decidedAt: null, decidedById: null } })
      : await this.prisma.jobApplication.create({ data: { jobId, studentId: user.id, statement: dto.statement, availability: dto.availability || null, cgpaAtApply: elig.cgpa } });
    await this.audit.record({ action: 'employment.applied', module: 'employment', targetType: 'JobApplication', targetId: app.id, metadata: { job: job.title } });
    return app;
  }

  async withdraw(user: AuthUser, applicationId: string) {
    const app = await this.prisma.jobApplication.findUnique({ where: { id: applicationId } });
    if (!app || app.studentId !== user.id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Application not found.' });
    if (app.status !== 'SUBMITTED' && app.status !== 'SHORTLISTED') throw new ConflictException({ code: 'NOT_ALLOWED', message: 'This application can no longer be withdrawn. Contact Career Services.' });
    await this.prisma.jobApplication.update({ where: { id: app.id }, data: { status: 'WITHDRAWN' } });
    await this.audit.record({ action: 'employment.withdrawn', module: 'employment', targetType: 'JobApplication', targetId: app.id });
    return { ok: true };
  }
}
