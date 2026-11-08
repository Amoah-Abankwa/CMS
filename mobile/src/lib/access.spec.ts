import { canSee } from './access';

const me = (over: object) => ({ id: '1', type: 'STUDENT', firstName: 'A', lastName: 'B', email: null, indexNumber: 'ANU25400001', mustChangePassword: false, activeRoleKey: 'student', roles: [], permissions: [], studentProfile: null, staffProfile: null, ...over }) as never;

describe('who sees a menu entry', () => {
  it('follows the kind of account', () => {
    expect(canSee({ href: '/registration', label: 'x', audience: 'STUDENT' }, me({}))).toBe(true);
    expect(canSee({ href: '/opportunities', label: 'x', audience: 'STAFF' }, me({}))).toBe(false);
    expect(canSee({ href: '/library', label: 'x', audience: 'MEMBER' }, me({ type: 'PARTNER' }))).toBe(false);
  });
  it('follows the active role permissions', () => {
    expect(canSee({ href: '/teaching', label: 'x', permission: 'teaching.read' }, me({ type: 'STAFF', permissions: ['teaching.read'] }))).toBe(true);
    expect(canSee({ href: '/teaching', label: 'x', permission: 'teaching.read' }, me({ type: 'STAFF' }))).toBe(false);
    expect(canSee({ href: '/x', label: 'x', anyPermission: ['a', 'b'] }, me({ permissions: ['b'] }))).toBe(true);
  });
  it('shows nothing when signed out', () => {
    expect(canSee({ href: '/dashboard', label: 'x' }, null)).toBe(false);
  });
});
