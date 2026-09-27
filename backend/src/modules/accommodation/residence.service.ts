import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SemestersService } from '../academics/semesters.service';
import { ResidenceQuery } from './dto/accommodation.dto';

type Kind = 'UNIVERSITY' | 'PRIVATE' | 'OFF_CAMPUS' | 'UNKNOWN';

/** Where every student enrolled this semester lives, for the Dean of Students, Security and the Hostel Office. */
@Injectable()
export class ResidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semesters: SemestersService,
  ) {}

  async overview(q: ResidenceQuery) {
    const semester = await this.semesters.resolve(q.semesterId);
    const students = await this.prisma.user.findMany({
      where: {
        type: 'STUDENT',
        status: 'ACTIVE',
        registrations: { some: { semesterId: semester.id, status: 'APPROVED' } },
        ...(q.search
          ? { OR: [{ indexNumber: { contains: q.search, mode: 'insensitive' as const } }, { firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }] }
          : {}),
      },
      orderBy: { indexNumber: 'asc' },
      select: {
        id: true, indexNumber: true, firstName: true, lastName: true, phone: true,
        studentProfile: { select: { programme: { select: { name: true } }, currentLevel: true } },
        roomAllocations: { where: { semesterId: semester.id, status: 'ACCEPTED' }, select: { room: { select: { number: true, hostel: { select: { name: true } } } } } },
        privateBookings: { where: { semesterId: semester.id, status: 'ACCEPTED' }, select: { roomType: { select: { name: true, hostel: { select: { name: true, location: true } } } } } },
        residenceDeclarations: { where: { semesterId: semester.id }, select: { address: true, digitalAddress: true, landmark: true } },
      },
    });
    const rows = students.map((s) => {
      const uni = s.roomAllocations[0];
      const priv = s.privateBookings[0];
      const off = s.residenceDeclarations[0];
      const kind: Kind = uni ? 'UNIVERSITY' : priv ? 'PRIVATE' : off ? 'OFF_CAMPUS' : 'UNKNOWN';
      const where =
        kind === 'UNIVERSITY' ? `${uni.room.hostel.name}, room ${uni.room.number}`
        : kind === 'PRIVATE' ? `${priv.roomType.hostel.name}${priv.roomType.hostel.location ? `, ${priv.roomType.hostel.location}` : ''}`
        : kind === 'OFF_CAMPUS' ? [off.address, off.landmark, off.digitalAddress].filter(Boolean).join(', ')
        : null;
      return { id: s.id, indexNumber: s.indexNumber, firstName: s.firstName, lastName: s.lastName, phone: s.phone, programme: s.studentProfile?.programme.name ?? null, level: s.studentProfile?.currentLevel ?? null, kind, where };
    });
    const counts = { UNIVERSITY: 0, PRIVATE: 0, OFF_CAMPUS: 0, UNKNOWN: 0 } as Record<Kind, number>;
    rows.forEach((r) => counts[r.kind]++);
    const filtered = q.kind ? rows.filter((r) => r.kind === q.kind) : rows;
    return { semester, counts, total: filtered.length, page: q.page, pageSize: q.pageSize, items: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize) };
  }
}
