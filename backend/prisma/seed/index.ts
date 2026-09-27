import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { computeTotal, DEFAULT_DEVOTION_POLICY, devotionTimes, gradeFor, INCOMPLETE_GRADE, serviceDates, PERMISSIONS, ROLE_KEYS, ROLE_SCOPE, scopeValue, type Mark } from '@anu/shared';
import { PrismaClient } from '../../src/generated/prisma/client';
import { encrypt } from '../../src/core/crypto/crypto.util';
import { formatIndexNumber } from '../../src/modules/students/index-number';
import { DEFAULT_TEMPLATES } from '../../src/modules/notifications/templates';
import { courseLevel, courseSemester, DEFAULT_GRADING_SCALE, DEMO_BOOKS, DEMO_VENDORS, DEMO_HOSTELS, DEMO_PASSWORD, DEMO_VENUES, demoGender, DEMO_STAFF, DEMO_TOTP_SECRET, demoStudentName, GENERAL_STUDIES_DEPT, LEVELS, ROLE_DEFS, STRUCTURE } from './data';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }) });

async function seedAccess() {
  for (const key of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key }, update: {} });
  }
  const perms = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));
  for (const def of ROLE_DEFS) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      create: { key: def.key, name: def.name, description: def.description, logGroup: def.logGroup, isSystem: true },
      update: { name: def.name, description: def.description, logGroup: def.logGroup },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: def.permissions.map((k) => ({ roleId: role.id, permissionId: perms.get(k)! })) });
  }
}

async function seedAcademics() {
  for (const level of LEVELS) {
    await prisma.programmeLevel.upsert({ where: { code: level.code }, create: level, update: { name: level.name } });
  }
  for (const s of STRUCTURE) {
    const school = await prisma.school.upsert({ where: { code: s.code }, create: { code: s.code, name: s.name, isDemo: true }, update: { name: s.name } });
    for (const d of s.departments) {
      const dept = await prisma.department.upsert({
        where: { code: d.code },
        create: { code: d.code, name: d.name, schoolId: school.id, isDemo: true },
        update: { name: d.name },
      });
      for (const p of d.programmes) {
        await prisma.programme.upsert({
          where: { code: p.code },
          create: { code: p.code, name: p.name, departmentId: dept.id, levelCode: '4', durationYears: 4, isDemo: true },
          update: { name: p.name },
        });
      }
      for (const [code, title, credits] of d.courses) {
        await prisma.course.upsert({
          where: { code },
          create: { code, title, creditHours: credits, level: courseLevel(code), semesterNo: courseSemester(code), departmentId: dept.id, isDemo: true },
          update: { title, creditHours: credits, level: courseLevel(code), semesterNo: courseSemester(code) },
        });
      }
    }
  }
  await seedCurriculum();
  await seedAcademicYears();
}

/** Each programme takes its own department's courses plus the university-wide general studies courses. */
async function seedCurriculum() {
  const programmes = await prisma.programme.findMany({ select: { id: true, departmentId: true } });
  const general = await prisma.department.findUniqueOrThrow({ where: { code: GENERAL_STUDIES_DEPT } });
  const courses = await prisma.course.findMany({ select: { id: true, departmentId: true, level: true, semesterNo: true } });
  for (const p of programmes) {
    for (const c of courses.filter((c) => c.departmentId === p.departmentId || c.departmentId === general.id)) {
      await prisma.programmeCourse.upsert({
        where: { programmeId_courseId: { programmeId: p.id, courseId: c.id } },
        create: { programmeId: p.id, courseId: c.id, level: c.level, semesterNo: c.semesterNo },
        update: { level: c.level, semesterNo: c.semesterNo },
      });
    }
  }
}

async function seedAcademicYears() {
  const past = await prisma.academicYear.upsert({
    where: { label: '2025/2026' },
    create: { label: '2025/2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-08-31'), isCurrent: false },
    update: { isCurrent: false },
  });
  for (const [number, start, end] of [[1, '2025-09-01', '2026-01-31'], [2, '2026-02-01', '2026-08-31']] as const) {
    await prisma.semester.upsert({
      where: { academicYearId_number: { academicYearId: past.id, number } },
      create: { academicYearId: past.id, number, startDate: new Date(start), endDate: new Date(end) },
      update: { isCurrent: false },
    });
  }

  const current = await prisma.academicYear.upsert({
    where: { label: '2026/2027' },
    create: { label: '2026/2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-08-31'), isCurrent: true },
    update: { isCurrent: true },
  });
  // Registration for the first semester is open in the demo so students can try it straight away.
  await prisma.semester.upsert({
    where: { academicYearId_number: { academicYearId: current.id, number: 1 } },
    create: {
      academicYearId: current.id, number: 1, startDate: new Date('2026-09-01'), endDate: new Date('2027-01-31'), isCurrent: true,
      registrationOpensAt: new Date('2026-09-01T00:00:00Z'), registrationClosesAt: new Date('2026-11-30T23:59:59Z'), minCredits: 9, maxCredits: 24,
    },
    update: { isCurrent: true },
  });
  await prisma.semester.upsert({
    where: { academicYearId_number: { academicYearId: current.id, number: 2 } },
    create: { academicYearId: current.id, number: 2, startDate: new Date('2027-02-01'), endDate: new Date('2027-08-31') },
    update: {},
  });
}

/** Offers every first-semester course in the current semester and assigns demo lecturers. */
async function seedOfferings() {
  const semester = await prisma.semester.findFirstOrThrow({ where: { isCurrent: true } });
  const courses = await prisma.course.findMany({ where: { semesterNo: semester.number }, include: { department: true } });
  const lecturers = new Map(
    (await prisma.user.findMany({ where: { email: { in: ['lecturer.cs@demo.anu.edu.gh', 'dev.candidate@demo.anu.edu.gh', 'advisor.cs@demo.anu.edu.gh', 'lecturer.acc@demo.anu.edu.gh', 'coordinator.sba@demo.anu.edu.gh'] } } })).map((u) => [u.email!, u.id]),
  );
  const leadFor: Record<string, string[]> = {
    CSC: ['lecturer.cs@demo.anu.edu.gh', 'advisor.cs@demo.anu.edu.gh', 'dev.candidate@demo.anu.edu.gh'],
    ACC: ['lecturer.acc@demo.anu.edu.gh', 'coordinator.sba@demo.anu.edu.gh'],
  };
  let i = 0;
  for (const c of courses) {
    const offering = await prisma.courseOffering.upsert({
      where: { courseId_semesterId: { courseId: c.id, semesterId: semester.id } },
      create: { courseId: c.id, semesterId: semester.id },
      update: {},
    });
    const pool = leadFor[c.department.code];
    if (!pool) continue; // Other departments' courses start without a lecturer, as a real semester would.
    const userId = lecturers.get(pool[i++ % pool.length]);
    if (!userId) continue;
    await prisma.offeringLecturer.upsert({
      where: { offeringId_userId: { offeringId: offering.id, userId } },
      create: { offeringId: offering.id, userId, isLead: true },
      update: {},
    });
  }
}

/** Creates version 1 of the grading scale if none exists. After that, the Registry owns it. */
async function seedGradingScale() {
  if (await prisma.gradingScale.count()) return;
  const { bands, ...scale } = DEFAULT_GRADING_SCALE;
  await prisma.gradingScale.create({ data: { ...scale, version: 1, isActive: true, bands: { create: bands } } });
}

/** Deterministic pseudo-random mark between lo and hi, so every seed run gives the same demo data. */
function demoMark(seed: string, lo: number, hi: number) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((lo + (h % 1000) / 1000 * (hi - lo)) * 2) / 2;
}

const DEMO_SCHEME = [
  { name: 'Mid-semester test', kind: 'CONTINUOUS' as const, weight: 20, maxScore: 50 },
  { name: 'Assignments', kind: 'CONTINUOUS' as const, weight: 10, maxScore: 20 },
  { name: 'Quizzes', kind: 'CONTINUOUS' as const, weight: 10, maxScore: 20 },
  { name: 'End of semester examination', kind: 'EXAM' as const, weight: 60, maxScore: 100 },
];

/**
 * Computer Science demo data for the results workflow:
 * - last year (2025/2026 Semester 1): the 2025 intake's results, already published, so they have a GPA;
 * - this semester: the 2026 intake approved for their courses, with CSC 101 marks entered and ready to submit.
 */
async function seedDemoResults() {
  const cs = await prisma.programme.findUniqueOrThrow({ where: { code: 'BSC-CS' } });
  const lecturer = await prisma.user.findUniqueOrThrow({ where: { email: 'lecturer.cs@demo.anu.edu.gh' } });
  const advisor = await prisma.user.findUniqueOrThrow({ where: { email: 'advisor.cs@demo.anu.edu.gh' } });
  const scale = await prisma.gradingScale.findFirstOrThrow({ where: { isActive: true }, include: { bands: true } });
  const level100 = await prisma.programmeCourse.findMany({ where: { programmeId: cs.id, level: 100, semesterNo: 1 }, include: { course: true } });
  const past = await prisma.semester.findFirstOrThrow({ where: { number: 1, academicYear: { label: '2025/2026' } } });
  const current = await prisma.semester.findFirstOrThrow({ where: { isCurrent: true } });

  const approveAll = async (semesterId: string, admissionYear: number) => {
    const students = await prisma.user.findMany({ where: { isDemo: true, studentProfile: { programmeId: cs.id, admissionYear } }, orderBy: { indexNumber: 'asc' } });
    const offerings = [];
    for (const pc of level100) {
      offerings.push(await prisma.courseOffering.upsert({
        where: { courseId_semesterId: { courseId: pc.courseId, semesterId } },
        create: { courseId: pc.courseId, semesterId },
        update: {},
      }));
    }
    for (const st of students) {
      if (await prisma.courseRegistration.findUnique({ where: { studentId_semesterId: { studentId: st.id, semesterId } } })) continue;
      await prisma.courseRegistration.create({
        data: {
          studentId: st.id, semesterId, status: 'APPROVED', submittedAt: new Date(), reviewedAt: new Date(), reviewedById: advisor.id,
          items: { create: offerings.map((o) => ({ offeringId: o.id })) },
        },
      });
    }
    return { students, offerings };
  };

  const enterMarks = async (offeringId: string, students: Array<{ id: string; indexNumber: string | null }>, absentStudentId?: string) => {
    // Dr Agyeman is the single lead lecturer on the demo Computer Science courses.
    await prisma.offeringLecturer.updateMany({ where: { offeringId, userId: { not: lecturer.id } }, data: { isLead: false } });
    await prisma.offeringLecturer.upsert({
      where: { offeringId_userId: { offeringId, userId: lecturer.id } },
      create: { offeringId, userId: lecturer.id, isLead: true },
      update: { isLead: true },
    });
    if (await prisma.assessment.count({ where: { offeringId } })) return prisma.assessment.findMany({ where: { offeringId }, orderBy: { position: 'asc' } });
    const assessments = [];
    for (const [position, a] of DEMO_SCHEME.entries()) assessments.push(await prisma.assessment.create({ data: { ...a, position, offeringId, marksUpdatedAt: new Date() } }));
    for (const st of students) {
      for (const a of assessments) {
        // One student missed an exam last year, to show the IC (incomplete) grade.
        const absent = a.kind === 'EXAM' && st.id === absentStudentId && a.offeringId === last?.offerings[0]?.id;
        await prisma.assessmentMark.create({
          data: { assessmentId: a.id, studentId: st.id, enteredById: lecturer.id, absent, score: absent ? null : demoMark(`${st.indexNumber}${a.name}${offeringId}`, a.maxScore * 0.35, a.maxScore * 0.95) },
        });
      }
    }
    return assessments;
  };

  // Last year: published results for the 2025 intake.
  let last: Awaited<ReturnType<typeof approveAll>> | undefined;
  last = await approveAll(past.id, 2025);
  for (const o of last.offerings) {
    if (await prisma.resultSheet.findUnique({ where: { offeringId: o.id } })) continue;
    const assessments = await enterMarks(o.id, last.students, last.students[1]?.id);
    const course = level100.find((pc) => pc.courseId === o.courseId)!.course;
    const marks = await prisma.assessmentMark.findMany({ where: { assessmentId: { in: assessments.map((a) => a.id) } } });
    const published = new Date('2026-02-20T10:00:00Z');
    await prisma.resultSheet.create({
      data: {
        offeringId: o.id, status: 'PUBLISHED', scaleId: scale.id,
        submittedAt: published, submittedById: lecturer.id, hodApprovedAt: published, hodApprovedById: lecturer.id,
        deanApprovedAt: published, publishedAt: published,
        results: {
          create: last.students.map((st) => {
            const m = new Map<string, Mark>(marks.filter((x) => x.studentId === st.id).map((x) => [x.assessmentId, { score: x.score, absent: x.absent }]));
            const t = computeTotal(assessments, m);
            const band = gradeFor(t.total, scale.bands);
            return {
              studentId: st.id, credits: course.creditHours, caScore: t.caScore, examScore: t.examScore, total: t.total,
              grade: t.incomplete ? INCOMPLETE_GRADE : band.letter, gradePoint: t.incomplete ? 0 : band.gradePoint,
              isPass: !t.incomplete && band.isPass, incomplete: t.incomplete,
            };
          }),
        },
      },
    });
  }

  // This semester: 2026 intake approved, CSC 101 marks entered but not yet submitted.
  const now = await approveAll(current.id, 2026);
  const csc101 = now.offerings.find((o) => level100.find((pc) => pc.courseId === o.courseId)?.course.code === 'CSC 101');
  if (csc101) await enterMarks(csc101.id, now.students);
}

/**
 * Exams demo: venues; fee clearance for everyone approved this semester except one student;
 * and a draft timetable with a deliberate clash (CSC 101 and GNS 101 overlap) for the Exam Coordinator to fix.
 */
async function seedExams() {
  for (const v of DEMO_VENUES) await prisma.examVenue.upsert({ where: { name: v.name }, create: v, update: {} });
  const semester = await prisma.semester.findFirstOrThrow({ where: { isCurrent: true } });
  const finance = await prisma.user.findUniqueOrThrow({ where: { email: 'finance@demo.anu.edu.gh' } });

  const approved = await prisma.courseRegistration.findMany({
    where: { semesterId: semester.id, status: 'APPROVED' },
    orderBy: { student: { indexNumber: 'asc' } },
    select: { studentId: true },
  });
  for (const [i, r] of approved.entries()) {
    await prisma.financialClearance.upsert({
      where: { studentId_semesterId: { studentId: r.studentId, semesterId: semester.id } },
      // The second student still owes fees, to show a "not eligible" decision.
      create: { studentId: r.studentId, semesterId: semester.id, cleared: i !== 1, note: i !== 1 ? 'Paid in full' : 'Balance outstanding', updatedById: finance.id },
      update: {},
    });
  }

  const timetable = await prisma.examTimetable.upsert({ where: { semesterId: semester.id }, create: { semesterId: semester.id }, update: {} });
  if (await prisma.examSession.count({ where: { timetableId: timetable.id } })) return;
  const venue = (name: string) => prisma.examVenue.findUniqueOrThrow({ where: { name } });
  const offering = (code: string) => prisma.courseOffering.findFirst({ where: { semesterId: semester.id, course: { code } } });
  const invigilator = await prisma.user.findUniqueOrThrow({ where: { email: 'dev.candidate@demo.anu.edu.gh' } });
  const plan = [
    { code: 'CSC 101', at: '2026-12-07T09:00:00Z', minutes: 120, venue: 'Engineering Block, Room E101' },
    { code: 'GNS 101', at: '2026-12-07T10:00:00Z', minutes: 120, venue: 'Main Auditorium' },
    { code: 'CSC 103', at: '2026-12-08T09:00:00Z', minutes: 120, venue: 'ICT Laboratory 2' },
  ];
  for (const p of plan) {
    const o = await offering(p.code);
    if (!o) continue;
    await prisma.examSession.create({
      data: {
        timetableId: timetable.id, offeringId: o.id, startsAt: new Date(p.at), durationMinutes: p.minutes, venueId: (await venue(p.venue)).id,
        invigilators: p.code === 'CSC 101' ? { create: { userId: invigilator.id } } : undefined,
      },
    });
  }
}

/**
 * Attendance demo for CSC 101: a weekly Monday 08:00 lecture for the semester. The first three have
 * registers: one student attended all, one was late once, and one missed two of three (33%, below 75%).
 */
async function seedAttendance() {
  const semester = await prisma.semester.findFirstOrThrow({ where: { isCurrent: true } });
  const offering = await prisma.courseOffering.findFirst({ where: { semesterId: semester.id, course: { code: 'CSC 101' } } });
  if (!offering || (await prisma.classSession.count({ where: { offeringId: offering.id } }))) return;
  const lecturer = await prisma.user.findUniqueOrThrow({ where: { email: 'lecturer.cs@demo.anu.edu.gh' } });
  const students = await prisma.user.findMany({
    where: { registrations: { some: { semesterId: semester.id, status: 'APPROVED', items: { some: { offeringId: offering.id } } } } },
    orderBy: { indexNumber: 'asc' },
    select: { id: true },
  });
  const pattern: Array<Array<'PRESENT' | 'LATE' | 'ABSENT'>> = [
    ['PRESENT', 'PRESENT', 'PRESENT'],
    ['PRESENT', 'LATE', 'PRESENT'],
    ['ABSENT', 'ABSENT', 'PRESENT'],
  ];
  for (let week = 0; week < 13; week++) {
    const startsAt = new Date(Date.UTC(2026, 8, 7 + week * 7, 8, 0));
    const taken = week < 3;
    await prisma.classSession.create({
      data: {
        offeringId: offering.id, startsAt, durationMinutes: 120, kind: 'LECTURE', venue: 'Engineering Block, Room E101',
        topic: taken ? ['Course overview and history of computing', 'Number systems', 'Computer hardware basics'][week] : null,
        createdById: lecturer.id,
        attendanceTakenAt: taken ? new Date(startsAt.getTime() + 2 * 3_600_000) : null,
        records: taken
          ? { create: students.map((st, i) => ({ studentId: st.id, status: pattern[i % pattern.length][week], source: 'LECTURER' as const, markedById: lecturer.id })) }
          : undefined,
      },
    });
  }
}

/**
 * Devotion demo: every Monday, Tuesday, Thursday and Friday of the current semester. Services up to
 * 25 September 2026 are closed with records for the students approved this semester: one always early,
 * one often late, one who missed several.
 */
async function seedDevotion() {
  const semester = await prisma.semester.findFirstOrThrow({ where: { isCurrent: true } });
  if (await prisma.devotionService.count({ where: { semesterId: semester.id } })) return;
  const chaplain = await prisma.user.findUniqueOrThrow({ where: { email: 'chaplaincy@demo.anu.edu.gh' } });
  const students = await prisma.user.findMany({
    where: { registrations: { some: { semesterId: semester.id, status: 'APPROVED' } } },
    orderBy: { indexNumber: 'asc' },
    select: { id: true },
  });
  const lastPast = new Date('2026-09-25T23:59:59Z');
  const dates = serviceDates(semester.startDate, semester.endDate, DEFAULT_DEVOTION_POLICY.days);
  for (const [n, date] of dates.entries()) {
    const t = devotionTimes(date, DEFAULT_DEVOTION_POLICY);
    const past = t.endsAt < lastPast;
    const minute = (h: number, m: number) => new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
    // Patterns by student: [status, arrival]
    const pick = (i: number): ['EARLY' | 'LATE' | 'ABSENT', Date | null] => {
      if (i % 3 === 0) return ['EARLY', minute(7, 20 + (n % 8))];
      if (i % 3 === 1) return n % 2 ? ['LATE', minute(7, 52 + (n % 6))] : ['EARLY', minute(7, 40)];
      return n % 3 === 0 ? ['ABSENT', null] : ['EARLY', minute(7, 45)];
    };
    await prisma.devotionService.create({
      data: {
        date: new Date(`${date}T00:00:00Z`), semesterId: semester.id, ...t, createdById: chaplain.id,
        checkInSecret: past ? null : randomBytes(32).toString('base64url'),
        closedAt: past ? t.endsAt : null,
        theme: past ? ['Walking in faith', 'Serving one another', 'Excellence as worship', 'Gratitude'][n % 4] : null,
        records: past
          ? {
              create: students.map((st, i) => {
                const [status, arrivedAt] = pick(i);
                return { studentId: st.id, status, arrivedAt, source: status === 'ABSENT' ? ('CLOSE' as const) : i % 2 ? ('DOOR' as const) : ('SELF_CHECK_IN' as const), recordedById: status === 'ABSENT' ? null : chaplain.id };
              }),
            }
          : undefined,
      },
    });
  }
}

/**
 * Accommodation demo: four university halls with rooms, an open application window for the current
 * semester with twelve applications waiting to be allocated, and a private hostel owner with one verified
 * hostel and one awaiting verification.
 */
async function seedAccommodation(passwordHash: string) {
  // Earlier seeds did not record gender; hostels are single-gender, so fill it in for demo students.
  const ungendered = await prisma.studentProfile.findMany({ where: { gender: null, user: { isDemo: true } }, select: { id: true, user: { select: { firstName: true } } } });
  for (const p of ungendered) await prisma.studentProfile.update({ where: { id: p.id }, data: { gender: demoGender(p.user.firstName) } });

  for (const h of DEMO_HOSTELS) {
    const hostel = await prisma.hostel.upsert({
      where: { name: h.name },
      create: { kind: 'UNIVERSITY', name: h.name, gender: h.gender, location: h.location, facilities: h.facilities, verification: 'APPROVED' },
      update: {},
    });
    for (let n = h.rooms.from; n <= h.rooms.to; n++) {
      await prisma.room.upsert({
        where: { hostelId_number: { hostelId: hostel.id, number: `${h.rooms.prefix}${n}` } },
        create: { hostelId: hostel.id, number: `${h.rooms.prefix}${n}`, floor: String(Math.floor(n / 100)), capacity: h.rooms.capacity, roomType: h.rooms.roomType, pricePerSemester: h.rooms.price },
        update: {},
      });
    }
  }

  const semester = await prisma.semester.findFirstOrThrow({ where: { isCurrent: true } });
  await prisma.accommodationRound.upsert({
    where: { semesterId: semester.id },
    create: { semesterId: semester.id, opensAt: new Date('2026-08-01T00:00:00Z'), closesAt: new Date('2026-10-31T23:59:59Z'), acceptanceDays: 5 },
    update: {},
  });

  if (!(await prisma.hostelApplication.count({ where: { semesterId: semester.id } }))) {
    const halls = new Map((await prisma.hostel.findMany({ where: { kind: 'UNIVERSITY' } })).map((h) => [h.name, h.id]));
    const students = await prisma.user.findMany({
      where: { type: 'STUDENT', isDemo: true, status: 'ACTIVE' },
      orderBy: { indexNumber: 'asc' },
      take: 12,
      select: { id: true, studentProfile: { select: { gender: true } } },
    });
    for (const [i, st] of students.entries()) {
      const female = st.studentProfile?.gender === 'Female';
      const first = female ? (i % 2 ? 'Mercy Hall' : 'Grace Hall') : i % 2 ? 'Hope Hall' : 'Faith Hall';
      const second = female ? (first === 'Grace Hall' ? 'Mercy Hall' : 'Grace Hall') : first === 'Faith Hall' ? 'Hope Hall' : 'Faith Hall';
      await prisma.hostelApplication.create({
        data: {
          semesterId: semester.id,
          studentId: st.id,
          preferences: [{ hostelId: halls.get(first)!, roomType: null }, { hostelId: halls.get(second)!, roomType: null }],
          acceptAny: i % 3 !== 0,
          specialNeeds: i === 5 ? 'Uses crutches after knee surgery; needs a ground-floor room near the washroom.' : null,
          submittedAt: new Date(Date.UTC(2026, 7, 5 + i, 9, 0)),
        },
      });
    }
  }

  // Private hostel owner (a partner account) with one verified hostel and one awaiting verification.
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.anu.edu.gh' },
    create: {
      type: 'PARTNER', status: 'ACTIVE', email: 'owner@demo.anu.edu.gh', firstName: 'Comfort', lastName: 'Ampofo', phone: '233244000999',
      passwordHash, primaryRoleKey: ROLE_KEYS.PRIVATE_HOSTEL_OWNER, isDemo: true,
      mfaFactor: { create: { secretEncrypted: encrypt(DEMO_TOTP_SECRET), confirmedAt: new Date() } },
      roles: { create: { role: { connect: { key: ROLE_KEYS.PRIVATE_HOSTEL_OWNER } } } },
    },
    update: {},
  });
  const verified = await prisma.hostel.upsert({
    where: { name: 'Koforidua Heights Hostel' },
    create: {
      kind: 'PRIVATE', name: 'Koforidua Heights Hostel', gender: 'MIXED', ownerId: owner.id, location: 'Oyoko, Koforidua', digitalAddress: 'EN-012-3456',
      distanceNote: 'About 10 minutes walk to campus', description: 'Gated compound with a caretaker on site. Water tank and backup generator.',
      facilities: ['Security', 'Backup power', 'Water tank', 'Wi-Fi'], contactPhone: '233244000999', verification: 'APPROVED', verifiedAt: new Date('2026-07-20T10:00:00Z'),
    },
    update: {},
  });
  if (!(await prisma.privateRoomType.count({ where: { hostelId: verified.id } }))) {
    await prisma.privateRoomType.createMany({
      data: [
        { hostelId: verified.id, name: '2 in a room, self-contained', bedsPerRoom: 2, pricePerSemester: 280000, availableBeds: 6 },
        { hostelId: verified.id, name: '4 in a room, shared washroom', bedsPerRoom: 4, pricePerSemester: 170000, availableBeds: 12 },
      ],
    });
  }
  await prisma.hostel.upsert({
    where: { name: 'Adweso Green Lodge' },
    create: {
      kind: 'PRIVATE', name: 'Adweso Green Lodge', gender: 'FEMALE', ownerId: owner.id, location: 'Adweso, Koforidua', distanceNote: 'Short taxi ride',
      description: 'New building, female students only.', facilities: ['Security', 'Kitchen'], verification: 'PENDING',
      roomTypes: { create: { name: 'Single room', bedsPerRoom: 1, pricePerSemester: 350000, availableBeds: 4 } },
    },
    update: {},
  });
}

/**
 * Library demo: fifteen titles for the demo courses with barcoded copies, some reference-only.
 * Current loans for demo students include one overdue (so a fine shows on return), a fine owed from
 * an earlier late return, and a reservation queue on a title whose copy is out.
 */
async function seedLibrary() {
  if (await prisma.libraryTitle.count()) return;
  let n = 1;
  for (const [title, authors, isbn, publisher, year, callNumber, subjects, copies, reference] of DEMO_BOOKS) {
    await prisma.libraryTitle.create({
      data: {
        title, authors, isbn, publisher, year, callNumber, subjects,
        searchText: [title, ...authors, isbn, callNumber, ...subjects].join(' ').toLowerCase(),
        copies: {
          create: Array.from({ length: copies + reference }, (_, i) => ({
            barcode: `ANUL${String(n++).padStart(6, '0')}`,
            shelf: `${callNumber.split(' ')[0]}, main library`,
            isReference: i >= copies,
          })),
        },
      },
    });
  }

  const librarian = await prisma.user.findUniqueOrThrow({ where: { email: 'librarian@demo.anu.edu.gh' } });
  const students = await prisma.user.findMany({ where: { type: 'STUDENT', isDemo: true, status: 'ACTIVE' }, orderBy: { indexNumber: 'asc' }, take: 6, select: { id: true } });
  const copyOf = async (isbn: string) =>
    prisma.libraryCopy.findFirstOrThrow({ where: { title: { isbn }, status: 'AVAILABLE', isReference: false }, orderBy: { barcode: 'asc' } });
  const lend = async (studentId: string, isbn: string, issued: string, due: string) => {
    const copy = await copyOf(isbn);
    await prisma.libraryCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });
    return prisma.loan.create({ data: { copyId: copy.id, borrowerId: studentId, issuedAt: new Date(issued), dueAt: new Date(due), issuedById: librarian.id } });
  };

  // Due in the future.
  await lend(students[0].id, '9781718502703', '2026-09-21T10:00:00Z', '2026-10-05T23:59:59Z');
  await lend(students[0].id, '9780393538700', '2026-09-22T10:00:00Z', '2026-10-06T23:59:59Z');
  // Overdue since 14 September: returning it at the desk creates a fine.
  await lend(students[1].id, '9781260091991', '2026-08-31T10:00:00Z', '2026-09-14T23:59:59Z');
  // The only lendable copy of Clean Code is out, and two students are queued for it.
  await lend(students[2].id, '9780132350884', '2026-09-15T10:00:00Z', '2026-09-29T23:59:59Z');
  const clean = await prisma.libraryTitle.findUniqueOrThrow({ where: { isbn: '9780132350884' } });
  await prisma.libraryReservation.create({ data: { titleId: clean.id, borrowerId: students[3].id, createdAt: new Date('2026-09-18T09:00:00Z') } });
  await prisma.libraryReservation.create({ data: { titleId: clean.id, borrowerId: students[4].id, createdAt: new Date('2026-09-20T09:00:00Z') } });

  // A fine from an earlier late return, still unpaid.
  const earlier = await prisma.libraryCopy.findFirstOrThrow({ where: { title: { isbn: '9780135581858' }, isReference: false }, orderBy: { barcode: 'asc' } });
  const old = await prisma.loan.create({
    data: { copyId: earlier.id, borrowerId: students[5].id, issuedAt: new Date('2026-06-01T10:00:00Z'), dueAt: new Date('2026-06-15T23:59:59Z'), returnedAt: new Date('2026-06-27T11:00:00Z'), status: 'RETURNED', issuedById: librarian.id, returnedById: librarian.id },
  });
  await prisma.libraryFine.create({ data: { borrowerId: students[5].id, loanId: old.id, reason: 'OVERDUE', amount: 1200, note: 'Returned 12 days late', createdAt: new Date('2026-06-27T11:00:00Z') } });
}

/**
 * Marketplace demo: two approved vendors with menus, one awaiting approval, and past orders:
 * completed online orders (for the settlements report) and one order waiting for the vendor.
 */
async function seedMarketplace(passwordHash: string) {
  if (await prisma.vendor.count()) return;
  const role = await prisma.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.VENDOR } });
  const vendors = [];
  for (const v of DEMO_VENDORS) {
    const owner = await prisma.user.upsert({
      where: { email: v.email },
      create: {
        type: 'PARTNER', status: 'ACTIVE', email: v.email, firstName: v.firstName, lastName: v.lastName, phone: v.phone, passwordHash,
        primaryRoleKey: ROLE_KEYS.VENDOR, isDemo: true, roles: { create: { roleId: role.id } },
        mfaFactor: { create: { secretEncrypted: encrypt(DEMO_TOTP_SECRET), confirmedAt: new Date() } },
      },
      update: {},
    });
    const vendor = await prisma.vendor.create({
      data: {
        ownerId: owner.id, name: v.name, description: v.description, location: v.location, phone: v.phone, openingHours: v.hours,
        offersDelivery: v.offersDelivery, deliveryFee: v.deliveryFee, deliveryNote: v.deliveryNote, minimumOrder: v.minimumOrder, prepMinutes: v.prepMinutes,
        status: v.status, reviewedAt: v.status === 'APPROVED' ? new Date('2026-08-20T10:00:00Z') : null,
        payoutNetwork: v.payout?.network, payoutNumber: v.payout?.number, payoutName: v.payout?.name,
      },
    });
    let position = 0;
    for (const [category, items] of Object.entries(v.menu)) {
      const c = await prisma.menuCategory.create({ data: { vendorId: vendor.id, name: category, position: position++ } });
      await prisma.menuItem.createMany({ data: items.map(([name, price, tags], i) => ({ vendorId: vendor.id, categoryId: c.id, name, price, tags, position: i })) });
    }
    vendors.push(vendor);
  }

  const cafeteria = vendors[0];
  const items = await prisma.menuItem.findMany({ where: { vendorId: cafeteria.id }, orderBy: { position: 'asc' } });
  const customers = await prisma.user.findMany({ where: { type: 'STUDENT', isDemo: true, status: 'ACTIVE' }, orderBy: { indexNumber: 'asc' }, take: 5, select: { id: true } });
  const order = async (i: number, when: string, status: 'COMPLETED' | 'PLACED', online: boolean, lines: Array<[number, number]>) => {
    const picked = lines.map(([idx, qty]) => ({ item: items[idx % items.length], qty }));
    const subtotal = picked.reduce((s, p) => s + p.item.price * p.qty, 0);
    const at = new Date(when);
    const o = await prisma.foodOrder.create({
      data: {
        vendorId: cafeteria.id, customerId: customers[i % customers.length].id, status, fulfilment: 'PICKUP', paymentOption: online ? 'ONLINE' : 'ON_PICKUP',
        subtotal, deliveryFee: 0, total: subtotal, pickupCode: String(1000 + i * 137).slice(0, 4), paid: online || status === 'COMPLETED',
        placedAt: at, acceptedAt: status === 'COMPLETED' ? at : null, readyAt: status === 'COMPLETED' ? at : null, completedAt: status === 'COMPLETED' ? new Date(at.getTime() + 25 * 60_000) : null,
        createdAt: at,
        items: { create: picked.map((p) => ({ menuItemId: p.item.id, name: p.item.name, unitPrice: p.item.price, quantity: p.qty, lineTotal: p.item.price * p.qty })) },
      },
    });
    if (online) {
      await prisma.payment.create({
        data: { reference: `ANU-DEMO-${o.number}`, provider: 'demo', purpose: 'FOOD_ORDER', userId: o.customerId, orderId: o.id, amount: subtotal, status: 'SUCCEEDED', channel: 'mobile_money', paidAt: at, createdAt: at },
      });
    }
  };
  await order(0, '2026-09-21T12:10:00Z', 'COMPLETED', true, [[0, 1], [7, 1]]);
  await order(1, '2026-09-22T12:40:00Z', 'COMPLETED', true, [[4, 1]]);
  await order(2, '2026-09-23T13:05:00Z', 'COMPLETED', false, [[2, 2], [8, 2]]);
  await order(3, '2026-09-24T18:15:00Z', 'COMPLETED', true, [[1, 1], [9, 1]]);
  await order(4, '2026-09-26T08:30:00Z', 'PLACED', false, [[5, 1], [7, 1]]);
}

async function seedTemplates() {
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.notificationTemplate.upsert({ where: { eventKey: t.eventKey }, create: t, update: {} });
  }
}

async function seedStaff(passwordHash: string) {
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.key, r.id]));
  const depts = new Map((await prisma.department.findMany()).map((d) => [d.code, d.id]));
  let n = 1;
  for (const s of DEMO_STAFF) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      create: {
        type: 'STAFF', status: 'ACTIVE', email: s.email, firstName: s.firstName, lastName: s.lastName, phone: `23324000${String(n).padStart(4, '0')}`,
        passwordHash, primaryRoleKey: s.roles[0], isDemo: true,
        staffProfile: { create: { staffNumber: `DEMO-STF-${String(n).padStart(4, '0')}`, title: s.title, departmentId: s.dept ? depts.get(s.dept) : undefined, isTeaching: !!s.teaching } },
        mfaFactor: { create: { secretEncrypted: encrypt(DEMO_TOTP_SECRET), confirmedAt: new Date() } },
      },
      update: {},
    });
    for (const key of s.roles) {
      const roleId = roles.get(key)!;
      // Head of Department is tied to the person's own department in the demo data.
      const scope = ROLE_SCOPE[key] === 'department' && s.dept ? scopeValue('department', depts.get(s.dept)!) : null;
      const existing = await prisma.userRole.findFirst({ where: { userId: user.id, roleId, scope } });
      if (!existing) await prisma.userRole.create({ data: { userId: user.id, roleId, scope } });
    }
    n++;
  }
}

async function seedStudents(passwordHash: string) {
  const programmes = await prisma.programme.findMany({ orderBy: { code: 'asc' } });
  const studentRoleId = (await prisma.role.findUniqueOrThrow({ where: { key: ROLE_KEYS.STUDENT } })).id;
  const existing = await prisma.user.count({ where: { type: 'STUDENT', isDemo: true } });
  if (existing > 0) return;

  let i = 0;
  for (const year of [2025, 2026]) {
    for (let k = 0; k < 20; k++, i++) {
      const programme = programmes[i % programmes.length];
      const counter = await prisma.indexNumberCounter.upsert({
        where: { admissionYear_levelCode: { admissionYear: year, levelCode: programme.levelCode } },
        create: { admissionYear: year, levelCode: programme.levelCode, lastValue: 1 },
        update: { lastValue: { increment: 1 } },
      });
      const { firstName, lastName, gender } = demoStudentName(i);
      const indexNumber = formatIndexNumber(year, programme.levelCode, counter.lastValue);
      await prisma.user.create({
        data: {
          type: 'STUDENT', status: 'ACTIVE', firstName, lastName, indexNumber, passwordHash, isDemo: true,
          email: `${indexNumber.toLowerCase()}@students.demo.anu.edu.gh`,
          phone: `23355000${String(i).padStart(4, '0')}`,
          primaryRoleKey: ROLE_KEYS.STUDENT,
          roles: { create: { roleId: studentRoleId } },
          studentProfile: { create: { programmeId: programme.id, levelCode: programme.levelCode, admissionYear: year, currentLevel: year === 2025 ? 200 : 100, gender } },
        },
      });
    }
  }
}

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  await seedAccess();
  await seedAcademics();
  await seedTemplates();
  await seedGradingScale();
  await seedStaff(passwordHash);
  await seedStudents(passwordHash);
  await seedOfferings();
  await seedDemoResults();
  await seedExams();
  await seedAttendance();
  await seedDevotion();
  await seedAccommodation(passwordHash);
  await seedLibrary();
  await seedMarketplace(passwordHash);
  await prisma.systemSetting.upsert({ where: { key: 'demo_mode' }, create: { key: 'demo_mode', value: true }, update: {} });
  console.log('Seed complete. Demo accounts are listed in docs/DEMO_ACCOUNTS.md');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
