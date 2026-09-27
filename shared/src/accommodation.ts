/**
 * University hostel allocation rules, shared by backend and frontend. Pure, so they can be tested.
 */

export type Gender = 'MALE' | 'FEMALE';
export type PriorityGroup = 'SPECIAL_NEEDS' | 'FIRST_YEAR' | 'FINAL_YEAR' | 'CONTINUING';

export const PRIORITY_ORDER: PriorityGroup[] = ['SPECIAL_NEEDS', 'FIRST_YEAR', 'FINAL_YEAR', 'CONTINUING'];

export const PRIORITY_LABELS: Record<PriorityGroup, string> = {
  SPECIAL_NEEDS: 'Confirmed special needs',
  FIRST_YEAR: 'First year',
  FINAL_YEAR: 'Final year',
  CONTINUING: 'Continuing student',
};

export function priorityGroup(input: { specialNeedsApproved: boolean; level: number; finalLevel: number }): PriorityGroup {
  if (input.specialNeedsApproved) return 'SPECIAL_NEEDS';
  if (input.level <= 100) return 'FIRST_YEAR';
  if (input.level >= input.finalLevel) return 'FINAL_YEAR';
  return 'CONTINUING';
}

export interface Applicant {
  applicationId: string;
  studentId: string;
  gender: Gender | null;
  group: PriorityGroup;
  submittedAt: Date;
  /** In order of preference. roomType null means any room type in that hostel. */
  preferences: Array<{ hostelId: string; roomType: string | null }>;
  /** Place anywhere suitable if none of the preferences has a bed. */
  acceptAny: boolean;
}

export interface RoomWithBeds {
  roomId: string;
  hostelId: string;
  hostelGender: Gender;
  roomType: string;
  label: string;
  capacity: number;
  /** Beds already taken by offers and acceptances. */
  occupied: number;
}

export interface Placement {
  applicationId: string;
  studentId: string;
  roomId: string;
  /** 1 for first choice; null when placed under "any hostel". */
  preferenceRank: number | null;
}

export interface Unplaced {
  applicationId: string;
  studentId: string;
  reason: 'NO_GENDER' | 'NO_BED';
}

/** Priority group first, then earliest application. */
export function orderApplicants(applicants: Applicant[]): Applicant[] {
  return [...applicants].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.group) - PRIORITY_ORDER.indexOf(b.group) || a.submittedAt.getTime() - b.submittedAt.getTime() || a.applicationId.localeCompare(b.applicationId),
  );
}

/**
 * Allocates beds. Each applicant gets their highest preference with a free bed in a hostel of their
 * gender. Among suitable rooms, the fullest one is used first so rooms fill up before new ones start.
 * Never places more students in a room than it has beds.
 */
export function allocateBeds(applicants: Applicant[], rooms: RoomWithBeds[]): { placements: Placement[]; unplaced: Unplaced[] } {
  const beds = rooms.map((r) => ({ ...r }));
  const placements: Placement[] = [];
  const unplaced: Unplaced[] = [];

  const pick = (candidates: typeof beds) =>
    candidates
      .filter((r) => r.occupied < r.capacity)
      .sort((a, b) => b.occupied - a.occupied || a.label.localeCompare(b.label, undefined, { numeric: true }))[0];

  for (const a of orderApplicants(applicants)) {
    if (!a.gender) {
      unplaced.push({ applicationId: a.applicationId, studentId: a.studentId, reason: 'NO_GENDER' });
      continue;
    }
    const suitable = beds.filter((r) => r.hostelGender === a.gender);
    let room: (typeof beds)[number] | undefined;
    let rank: number | null = null;
    for (const [i, pref] of a.preferences.entries()) {
      room = pick(suitable.filter((r) => r.hostelId === pref.hostelId && (!pref.roomType || r.roomType === pref.roomType)));
      if (room) {
        rank = i + 1;
        break;
      }
    }
    if (!room && a.acceptAny) room = pick(suitable);
    if (!room) {
      unplaced.push({ applicationId: a.applicationId, studentId: a.studentId, reason: 'NO_BED' });
      continue;
    }
    room.occupied++;
    placements.push({ applicationId: a.applicationId, studentId: a.studentId, roomId: room.roomId, preferenceRank: rank });
  }
  return { placements, unplaced };
}

/** Prices are stored in pesewas to avoid rounding errors. */
export function formatCedis(pesewas: number) {
  return `GH₵ ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** GhanaPost GPS digital address, e.g. GA-123-4567 or EN-0123-4567. */
export const DIGITAL_ADDRESS = /^[A-Z]{2}-\d{3,4}-\d{4}$/;
