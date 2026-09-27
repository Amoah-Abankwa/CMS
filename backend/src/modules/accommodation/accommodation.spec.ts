import { allocateBeds, formatCedis, orderApplicants, priorityGroup, type Applicant, type RoomWithBeds } from '@anu/shared';

const at = (m: number) => new Date(Date.UTC(2026, 7, 1, 0, m));
const applicant = (id: string, gender: 'MALE' | 'FEMALE' | null, group: Applicant['group'], minute: number, prefs: string[], acceptAny = false): Applicant => ({
  applicationId: id, studentId: `s${id}`, gender, group, submittedAt: at(minute), preferences: prefs.map((hostelId) => ({ hostelId, roomType: null })), acceptAny,
});
const room = (id: string, hostelId: string, gender: 'MALE' | 'FEMALE', capacity: number, occupied = 0, roomType = '2 in a room'): RoomWithBeds => ({
  roomId: id, hostelId, hostelGender: gender, roomType, label: id, capacity, occupied,
});

describe('hostel allocation', () => {
  it('works out priority groups', () => {
    expect(priorityGroup({ specialNeedsApproved: true, level: 300, finalLevel: 400 })).toBe('SPECIAL_NEEDS');
    expect(priorityGroup({ specialNeedsApproved: false, level: 100, finalLevel: 400 })).toBe('FIRST_YEAR');
    expect(priorityGroup({ specialNeedsApproved: false, level: 400, finalLevel: 400 })).toBe('FINAL_YEAR');
    expect(priorityGroup({ specialNeedsApproved: false, level: 200, finalLevel: 400 })).toBe('CONTINUING');
  });

  it('orders by priority group, then by who applied first', () => {
    const order = orderApplicants([applicant('c', 'MALE', 'CONTINUING', 1, []), applicant('f2', 'MALE', 'FIRST_YEAR', 9, []), applicant('f1', 'MALE', 'FIRST_YEAR', 5, []), applicant('s', 'MALE', 'SPECIAL_NEEDS', 30, [])]);
    expect(order.map((a) => a.applicationId)).toEqual(['s', 'f1', 'f2', 'c']);
  });

  it('gives the last bed to the higher priority group', () => {
    const r = allocateBeds([applicant('cont', 'MALE', 'CONTINUING', 1, ['H']), applicant('fresh', 'MALE', 'FIRST_YEAR', 50, ['H'])], [room('H1', 'H', 'MALE', 1)]);
    expect(r.placements.map((p) => p.applicationId)).toEqual(['fresh']);
    expect(r.unplaced).toEqual([{ applicationId: 'cont', studentId: 'scont', reason: 'NO_BED' }]);
  });

  it('uses the next preference when the first is full', () => {
    const r = allocateBeds([applicant('a', 'FEMALE', 'CONTINUING', 1, ['X', 'Y'])], [room('Y1', 'Y', 'FEMALE', 2), room('X1', 'X', 'FEMALE', 2, 2)]);
    expect(r.placements[0]).toMatchObject({ roomId: 'Y1', preferenceRank: 2 });
  });

  it('fills partly used rooms first and never over capacity', () => {
    const many = Array.from({ length: 10 }, (_, i) => applicant(`p${i}`, 'MALE', 'CONTINUING', i, ['H'], true));
    const r = allocateBeds(many, [room('H1', 'H', 'MALE', 4), room('H2', 'H', 'MALE', 2, 1), room('O1', 'O', 'MALE', 3)]);
    const perRoom = r.placements.reduce<Record<string, number>>((m, p) => ({ ...m, [p.roomId]: (m[p.roomId] ?? 0) + 1 }), {});
    expect(r.placements[0].roomId).toBe('H2');
    expect(perRoom).toEqual({ H2: 1, H1: 4, O1: 3 });
    expect(r.unplaced).toHaveLength(2);
  });

  it('never places a student in a hostel for the other gender', () => {
    const r = allocateBeds([applicant('a', 'FEMALE', 'CONTINUING', 1, ['M'], true)], [room('M1', 'M', 'MALE', 4)]);
    expect(r.placements).toHaveLength(0);
  });

  it('reports students with no gender on record', () => {
    expect(allocateBeds([applicant('a', null, 'FIRST_YEAR', 1, ['H'], true)], [room('H1', 'H', 'MALE', 4)]).unplaced[0].reason).toBe('NO_GENDER');
  });

  it('formats cedis from pesewas', () => {
    expect(formatCedis(185000)).toBe('GH₵ 1,850.00');
  });
});
