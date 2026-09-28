import { Coins, ArrowLeftRight, BadgeAlert, FilePenLine, ClipboardList as RegisterIcon, Images, UserCheck, Network, Hash, Tags, Banknote, Landmark, Users2, Receipt, Bike, Wallet, UserRoundCheck, Activity, Award, Ban, BedDouble, ChefHat, HandCoins, Store, Utensils, UtensilsCrossed, BookCopy, BookMarked, ScanBarcode, TimerOff, Wrench, Bell, Building, Home, MapPinned, Shuffle, BadgeCheck, Church, MonitorPlay, SlidersHorizontal, Trophy, ChartColumn, ClipboardPen, Hospital, Settings2, Building2, CalendarClock, ClipboardList, BookOpenCheck, FileCheck2, Scale, BriefcaseBusiness, CalendarRange, ClipboardCheck, Code2, History, LayoutDashboard, Library, ListChecks, ScrollText, ShieldCheck, UserPlus, Users, type LucideIcon, FileText, DoorOpen, HeartOff } from 'lucide-react';
import { PERMISSIONS } from '@anu/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only when the active role holds this permission. */
  permission?: string;
  /** Shown when the active role holds any one of these. */
  anyPermission?: string[];
  /** Shown only to this kind of account. MEMBER means students and staff (not external partners). */
  audience?: 'STUDENT' | 'STAFF' | 'MEMBER';
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    label: 'General',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/registration', label: 'Course registration', icon: ListChecks, audience: 'STUDENT' },
      { href: '/results', label: 'Results', icon: Award, audience: 'STUDENT' },
      { href: '/attendance', label: 'Attendance', icon: UserCheck, audience: 'STUDENT' },
      { href: '/exams', label: 'Exams', icon: CalendarClock, audience: 'STUDENT' },
      { href: '/devotion', label: 'Morning devotion', icon: Church, audience: 'STUDENT' },
      { href: '/accommodation', label: 'Accommodation', icon: BedDouble, audience: 'STUDENT' },
      { href: '/library', label: 'Library', icon: BookMarked, audience: 'MEMBER' },
      { href: '/food', label: 'Food', icon: Utensils, audience: 'MEMBER' },
      { href: '/fees', label: 'Fees', icon: Banknote, audience: 'STUDENT' },
      { href: '/dues', label: 'Departmental dues', icon: Receipt, audience: 'STUDENT' },
      { href: '/excuses', label: 'Excuse requests', icon: FileText, audience: 'STUDENT' },
      { href: '/association', label: 'Association dues', icon: Users2, permission: PERMISSIONS.DUES_COLLECT },
      { href: '/jobs', label: 'Campus jobs', icon: BriefcaseBusiness, audience: 'STUDENT' },
      { href: '/dispatch', label: 'Deliveries', icon: Bike, permission: PERMISSIONS.DISPATCH_DELIVER },
      { href: '/dispatch/earnings', label: 'My earnings', icon: Wallet, permission: PERMISSIONS.DISPATCH_DELIVER },
      { href: '/my-hostel', label: 'My hostel', icon: Home, permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/my-hostel/photos', label: 'Hostel photos', icon: Images, permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/my-hostel/fees', label: 'Hostel fees', icon: Coins, permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/my-hostel/residents', label: 'Residents', icon: DoorOpen, permission: PERMISSIONS.PRIVATE_HOSTEL_OWN },
      { href: '/notifications', label: 'Notifications', icon: Bell },
      { href: '/activity', label: 'My activity', icon: History },
      { href: '/account', label: 'Account and security', icon: ShieldCheck },
    ],
  },
  {
    label: 'Teaching',
    items: [{ href: '/teaching', label: 'My classes', icon: BookOpenCheck, permission: PERMISSIONS.TEACHING_READ }],
  },
  {
    label: 'Academic',
    items: [
      { href: '/academics/offerings', label: 'Course offerings', icon: Library, permission: PERMISSIONS.OFFERINGS_MANAGE },
      { href: '/academics/registrations', label: 'Registration approvals', icon: ClipboardCheck, permission: PERMISSIONS.REGISTRATIONS_REVIEW },
      { href: '/academics/dues-marker', label: 'Dues on exam registers', icon: BadgeAlert, permission: PERMISSIONS.RESULTS_APPROVE_DEPARTMENT },
      { href: '/academics/advisors', label: 'Academic advisors', icon: UserCheck, permission: PERMISSIONS.ADVISORS_ASSIGN },
      {
        href: '/academics/results',
        label: 'Results approval',
        icon: FileCheck2,
        anyPermission: [PERMISSIONS.RESULTS_APPROVE_DEPARTMENT, PERMISSIONS.RESULTS_APPROVE_SCHOOL, PERMISSIONS.RESULTS_PUBLISH, PERMISSIONS.RESULTS_READ_ALL],
      },
      { href: '/academics/semesters', label: 'Semesters', icon: CalendarRange, permission: PERMISSIONS.ACADEMICS_MANAGE },
      { href: '/academics/grading', label: 'Grading scale', icon: Scale, permission: PERMISSIONS.GRADING_MANAGE },
      { href: '/academics/attendance', label: 'Attendance reports', icon: ChartColumn, permission: PERMISSIONS.ATTENDANCE_REPORTS_READ },
      { href: '/academics/attendance-rules', label: 'Attendance rules', icon: Settings2, permission: PERMISSIONS.ACADEMICS_MANAGE },
    ],
  },
  {
    label: 'My shop',
    items: [
      { href: '/vendor', label: 'Orders', icon: ChefHat, permission: PERMISSIONS.VENDOR_OWN },
      { href: '/vendor/menu', label: 'Menu', icon: UtensilsCrossed, permission: PERMISSIONS.VENDOR_OWN },
      { href: '/vendor/profile', label: 'Shop settings', icon: Store, permission: PERMISSIONS.VENDOR_OWN },
    ],
  },
  {
    label: 'Registry',
    items: [
      { href: '/registry/structure', label: 'Academic structure', icon: Network, permission: PERMISSIONS.ACADEMICS_MANAGE },
      { href: '/registry/programme-types', label: 'Programme types', icon: Hash, permission: PERMISSIONS.ACADEMICS_MANAGE },
    ],
  },
  {
    label: 'Fees',
    items: [
      { href: '/finance/fees', label: 'Student fees', icon: Banknote, permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/fees/setup', label: 'Fee set-up', icon: Landmark, permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/fees/items', label: 'Fee items', icon: Tags, permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/fees/rates', label: 'Exchange rates', icon: ArrowLeftRight, permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/hostel-owners', label: 'Hostel owner payouts', icon: Coins, permission: PERMISSIONS.FEES_MANAGE },
      { href: '/finance/dues', label: 'Dues payouts', icon: Receipt, permission: PERMISSIONS.FEES_MANAGE },
      { href: '/student-affairs/associations', label: 'Departmental associations', icon: Users2, permission: PERMISSIONS.ASSOCIATIONS_MANAGE },
    ],
  },
  {
    label: 'Student employment',
    items: [
      { href: '/employment/jobs', label: 'Campus jobs', icon: BriefcaseBusiness, permission: PERMISSIONS.EMPLOYMENT_MANAGE },
      { href: '/employment/dispatchers', label: 'Dispatchers', icon: UserRoundCheck, permission: PERMISSIONS.EMPLOYMENT_MANAGE },
      { href: '/employment/rules', label: 'Employment rules', icon: SlidersHorizontal, permission: PERMISSIONS.EMPLOYMENT_MANAGE },
    ],
  },
  {
    label: 'Food marketplace',
    items: [
      { href: '/marketplace/vendors', label: 'Vendors', icon: Store, permission: PERMISSIONS.MARKETPLACE_MANAGE },
      { href: '/marketplace/settlements', label: 'Vendor settlements', icon: HandCoins, permission: PERMISSIONS.MARKETPLACE_MANAGE },
    ],
  },
  {
    label: 'Library',
    items: [
      { href: '/library/desk', label: 'Circulation desk', icon: ScanBarcode, permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/overdue', label: 'Overdue and reservations', icon: TimerOff, permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/fines', label: 'Library fines', icon: Coins, permission: PERMISSIONS.LIBRARY_CIRCULATE },
      { href: '/library/catalogue', label: 'Catalogue', icon: BookCopy, permission: PERMISSIONS.LIBRARY_MANAGE },
      { href: '/library/rules', label: 'Library rules', icon: Wrench, permission: PERMISSIONS.LIBRARY_MANAGE },
    ],
  },
  {
    label: 'Accommodation',
    items: [
      { href: '/hostels', label: 'University hostels', icon: Building, permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/allocation', label: 'Applications and allocation', icon: Shuffle, permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/fees', label: 'Hall fees', icon: Coins, permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/residents', label: 'Hall residents', icon: DoorOpen, permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/hostels/private', label: 'Private hostels', icon: BadgeCheck, permission: PERMISSIONS.HOSTELS_MANAGE },
      { href: '/residence', label: 'Where students live', icon: MapPinned, permission: PERMISSIONS.ACCOMMODATION_READ },
    ],
  },
  {
    label: 'Chaplaincy',
    items: [
      { href: '/chaplaincy/services', label: 'Devotion services', icon: MonitorPlay, permission: PERMISSIONS.DEVOTION_MANAGE },
      { href: '/chaplaincy/scores', label: 'Devotion scores', icon: Trophy, permission: PERMISSIONS.DEVOTION_READ },
      { href: '/chaplaincy/rules', label: 'Devotion rules', icon: SlidersHorizontal, permission: PERMISSIONS.DEVOTION_MANAGE },
      { href: '/chaplaincy/exemptions', label: 'Devotion exemptions', icon: HeartOff, permission: PERMISSIONS.DEVOTION_MANAGE },
    ],
  },
  {
    label: 'Student services',
    items: [{ href: '/attendance/excuses', label: 'Excused absences', icon: Hospital, permission: PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE }, { href: '/attendance/excuse-requests', label: 'Excuse requests', icon: FileText, permission: PERMISSIONS.ATTENDANCE_EXCUSES_MANAGE }],
  },
  {
    label: 'Examinations',
    items: [
      { href: '/exams/timetable', label: 'Exam timetable', icon: CalendarClock, permission: PERMISSIONS.EXAMS_MANAGE },
      { href: '/exams/eligibility', label: 'Exam eligibility', icon: ClipboardList, permission: PERMISSIONS.EXAMS_MANAGE },
      { href: '/exams/register', label: 'Exam register', icon: RegisterIcon, audience: 'STAFF' },
      { href: '/results/amendments', label: 'Result amendments', icon: FilePenLine, audience: 'STAFF' },
      { href: '/exams/venues', label: 'Exam venues', icon: Building2, permission: PERMISSIONS.EXAMS_MANAGE },
      { href: '/exams/clearance', label: 'Fee clearance', icon: Receipt, permission: PERMISSIONS.FINANCE_CLEARANCE_MANAGE },
      { href: '/exams/holds', label: 'Exam holds', icon: Ban, permission: PERMISSIONS.EXAM_HOLDS_MANAGE },
    ],
  },
  {
    label: 'Registry',
    items: [
      { href: '/students', label: 'Students', icon: Users, permission: PERMISSIONS.STUDENTS_READ },
      { href: '/students/new', label: 'Register student', icon: UserPlus, permission: PERMISSIONS.STUDENTS_REGISTER },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/staff', label: 'Staff', icon: BriefcaseBusiness, permission: PERMISSIONS.USERS_READ },
      { href: '/staff/new', label: 'Add staff member', icon: UserPlus, permission: PERMISSIONS.USERS_MANAGE },
      { href: '/admin/activity', label: 'All activity', icon: ScrollText, permission: PERMISSIONS.AUDIT_READ_ALL },
      { href: '/admin/developer-access', label: 'Developer access', icon: Code2, permission: PERMISSIONS.DEVELOPER_ACCESS_MANAGE },
    ],
  },
  {
    label: 'Developer',
    items: [{ href: '/system', label: 'System diagnostics', icon: Activity, permission: PERMISSIONS.SYSTEM_DIAGNOSTICS_READ }],
  },
];

export function visibleNav(permissions: string[], userType?: string): NavSection[] {
  const audience = userType === 'STUDENT' ? 'STUDENT' : 'STAFF';
  const member = userType === 'STUDENT' || userType === 'STAFF';
  return NAV.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) =>
        (!i.permission || permissions.includes(i.permission)) &&
        (!i.anyPermission || i.anyPermission.some((p) => permissions.includes(p))) &&
        (!i.audience || i.audience === audience || (i.audience === 'MEMBER' && member)),
    ),
  })).filter((s) => s.items.length > 0);
}
