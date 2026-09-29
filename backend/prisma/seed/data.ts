import { ACADEMIC_DECISION_PERMISSIONS, PERMISSIONS, PermissionKey, ROLE_KEYS, ROLE_LOG_GROUP, RoleKey } from '@anu/shared';

/** All demo data is fictional. */
export const DEMO_PASSWORD = 'AnuDemo#2025';
/** Shared TOTP secret for demo staff accounts. Add it to an authenticator app as "ANU Demo". Never use in production. */
export const DEMO_TOTP_SECRET = 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD';

const ALL = Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.SYSTEM_DIAGNOSTICS_READ && !ACADEMIC_DECISION_PERMISSIONS.includes(p));

const P = PERMISSIONS;
const READ_STUDENTS = [P.STUDENTS_READ, P.ACADEMICS_READ];

/**
 * Every role, with the permissions it holds today. Later phases add module permissions
 * (results, attendance, library, hostels and so on) to these same roles.
 */
export const ROLE_DEFS: Array<{ key: RoleKey; name: string; description: string; permissions: PermissionKey[]; logGroup: (typeof ROLE_LOG_GROUP)[RoleKey];}> = [
  { key: ROLE_KEYS.SUPER_ADMIN, name: 'Super Admin', description: 'Full control of accounts, roles and settings', permissions: ALL },
  { key: ROLE_KEYS.DEVELOPER, name: 'Developer', description: 'System diagnostics; enabled temporarily by a Super Admin', permissions: [P.SYSTEM_DIAGNOSTICS_READ] },

  { key: ROLE_KEYS.VICE_CHANCELLOR, name: 'Vice-Chancellor', description: 'University-wide oversight and reports', permissions: [...READ_STUDENTS, P.USERS_READ, P.AUDIT_READ_ALL, P.RESULTS_READ_ALL, P.ATTENDANCE_REPORTS_READ, P.DEVOTION_READ] },
  { key: ROLE_KEYS.PRO_VICE_CHANCELLOR, name: 'Pro Vice-Chancellor', description: 'Academic oversight and reports', permissions: [...READ_STUDENTS, P.USERS_READ, P.RESULTS_READ_ALL] },

  { key: ROLE_KEYS.DEAN, name: 'Dean', description: 'Oversees one school and approves its results', permissions: [...READ_STUDENTS, P.OFFERINGS_MANAGE, P.REGISTRATIONS_REVIEW, P.RESULTS_APPROVE_SCHOOL, P.ATTENDANCE_REPORTS_READ] },
  { key: ROLE_KEYS.HEAD_OF_DEPARTMENT, name: 'Head of Department', description: 'Leads one department, assigns courses, approves results', permissions: [...READ_STUDENTS, P.OFFERINGS_MANAGE, P.REGISTRATIONS_REVIEW, P.RESULTS_APPROVE_DEPARTMENT, P.ATTENDANCE_REPORTS_READ, P.ADVISORS_ASSIGN] },
  { key: ROLE_KEYS.PROGRAMME_COORDINATOR, name: 'Programme Coordinator', description: 'Manages programme structure and course registration for a department', permissions: [...READ_STUDENTS, P.OFFERINGS_MANAGE, P.REGISTRATIONS_REVIEW, P.ATTENDANCE_REPORTS_READ] },
  { key: ROLE_KEYS.ACADEMIC_ADVISOR, name: 'Academic Advisor', description: 'Advises students in a department and approves their course registration', permissions: [...READ_STUDENTS, P.REGISTRATIONS_REVIEW] },
  { key: ROLE_KEYS.LECTURER, name: 'Lecturer', description: 'Teaches courses, records attendance and marks', permissions: [P.ACADEMICS_READ, P.TEACHING_READ] },
  { key: ROLE_KEYS.TEACHING_ASSISTANT, name: 'Teaching Assistant', description: 'Helps a lecturer with attendance and continuous assessment', permissions: [P.ACADEMICS_READ, P.TEACHING_READ] },

  { key: ROLE_KEYS.REGISTRAR, name: 'Registrar', description: 'Registers students and manages academic records', permissions: [...READ_STUDENTS, P.STUDENTS_REGISTER, P.ACADEMICS_MANAGE, P.USERS_READ, P.OFFERINGS_MANAGE, P.REGISTRATIONS_REVIEW, P.GRADING_MANAGE, P.RESULTS_PUBLISH, P.RESULTS_READ_ALL, P.EXAMS_MANAGE, P.ATTENDANCE_REPORTS_READ, P.DEVOTION_READ, P.ADVISORS_ASSIGN] },
  { key: ROLE_KEYS.ADMISSIONS_OFFICER, name: 'Admissions Officer', description: 'Processes admissions and registers new students', permissions: [...READ_STUDENTS, P.STUDENTS_REGISTER] },
  { key: ROLE_KEYS.EXAM_COORDINATOR, name: 'Exam Coordinator', description: 'Exam timetables, eligibility and results publishing', permissions: [...READ_STUDENTS, P.NOTIFICATIONS_FAILED_READ, P.RESULTS_PUBLISH, P.RESULTS_READ_ALL, P.EXAMS_MANAGE, P.EXAM_HOLDS_MANAGE] },
  { key: ROLE_KEYS.QA_OFFICER, name: 'QA Officer', description: 'Quality assurance and lecturer evaluations', permissions: [...READ_STUDENTS, P.RESULTS_READ_ALL, P.ATTENDANCE_REPORTS_READ] },

  { key: ROLE_KEYS.DEAN_OF_STUDENTS, name: 'Dean of Students', description: 'Student welfare, conduct and discipline', permissions: [P.STUDENTS_READ, P.EXAM_HOLDS_MANAGE, P.ATTENDANCE_EXCUSES_MANAGE, P.DEVOTION_READ, P.ACCOMMODATION_READ, P.MARKETPLACE_MANAGE, P.EMPLOYMENT_MANAGE, P.ASSOCIATIONS_MANAGE] },
  { key: ROLE_KEYS.COUNSELLOR, name: 'Counsellor', description: 'Confidential student counselling', permissions: [P.STUDENTS_READ] },
  { key: ROLE_KEYS.CHAPLAINCY_OFFICER, name: 'Chaplaincy Officer', description: 'Morning devotion attendance and chapel records', permissions: [P.STUDENTS_READ, P.DEVOTION_MANAGE, P.DEVOTION_READ] },
  { key: ROLE_KEYS.HEALTH_OFFICER, name: 'Health Services Officer', description: 'Clinic visits and medical excuses for absence', permissions: [P.STUDENTS_READ, P.ATTENDANCE_EXCUSES_MANAGE] },
  { key: ROLE_KEYS.CAREER_SERVICES_OFFICER, name: 'Career Services Officer', description: 'Internships, on-campus jobs and dispatcher approvals', permissions: [P.STUDENTS_READ, P.EMPLOYMENT_MANAGE] },
  { key: ROLE_KEYS.HOSTEL_MANAGER, name: 'Hostel Manager', description: 'University hostel rooms and allocations', permissions: [P.STUDENTS_READ, P.HOSTELS_MANAGE, P.ACCOMMODATION_READ] },

  { key: ROLE_KEYS.LIBRARIAN, name: 'Librarian', description: 'Library catalogue, policies and fines', permissions: [P.STUDENTS_READ, P.LIBRARY_CIRCULATE, P.LIBRARY_MANAGE] },
  { key: ROLE_KEYS.LIBRARY_ASSISTANT, name: 'Library Assistant', description: 'Issues and receives books at the desk', permissions: [P.STUDENTS_READ, P.LIBRARY_CIRCULATE] },

  { key: ROLE_KEYS.FINANCE_OFFICER, name: 'Finance Officer', description: 'Fees, payments and financial clearance', permissions: [P.STUDENTS_READ, P.FINANCE_CLEARANCE_MANAGE, P.MARKETPLACE_MANAGE, P.FEES_MANAGE] },
  { key: ROLE_KEYS.HR_OFFICER, name: 'HR Officer', description: 'Staff records and employment details', permissions: [P.USERS_READ] },
  { key: ROLE_KEYS.ICT_SUPPORT, name: 'ICT Support', description: 'Helps users with sign-in problems and failed messages', permissions: [P.USERS_READ, P.STUDENTS_READ, P.NOTIFICATIONS_FAILED_READ] },
  { key: ROLE_KEYS.SECURITY_OFFICER, name: 'Security Officer', description: 'Campus security, visitor and hostel access records', permissions: [P.STUDENTS_READ, P.ACCOMMODATION_READ] },
  { key: ROLE_KEYS.INTERNAL_AUDITOR, name: 'Internal Auditor', description: 'Read-only review of activity logs', permissions: [P.AUDIT_READ_ALL, P.AUDIT_EXPORT] },

  { key: ROLE_KEYS.EXTERNAL_EXAMINER, name: 'External Examiner', description: 'Reviews and moderates results for assigned courses', permissions: [] },
  { key: ROLE_KEYS.PRIVATE_HOSTEL_OWNER, name: 'Private Hostel Owner', description: 'Lists private hostel rooms for students', permissions: [P.PRIVATE_HOSTEL_OWN] },
  { key: ROLE_KEYS.VENDOR, name: 'Cafeteria Manager / Vendor', description: 'Food menus and orders', permissions: [P.VENDOR_OWN] },

  { key: ROLE_KEYS.STUDENT, name: 'Student', description: 'Enrolled student', permissions: [] },
  { key: ROLE_KEYS.ASSOCIATION_OFFICER, name: 'Association Officer', description: 'Elected president or treasurer of a departmental association (EHASSA, BACA...). Added to the Student role for their term', permissions: [P.DUES_COLLECT] },
  { key: ROLE_KEYS.STUDENT_DISPATCHER, name: 'Student Dispatcher', description: 'Delivers campus orders; needs the minimum GPA. Added to the Student role, not switched into', permissions: [P.DISPATCH_DELIVER] },
].map((r) => ({ ...r, logGroup: ROLE_LOG_GROUP[r.key] }));

/** Programme types. The Registrar can change names, semesters and index formats in Registry, Programme types. */
export const LEVELS = [
  { code: '4', name: "Bachelor's degree (regular)", description: 'Undergraduate degrees, weekday classes', category: 'BACHELORS' as const, mode: 'REGULAR' as const, semesters: 8, indexFormat: 'ANU{YY}{CODE}{SEQ:5}' },
  { code: 'W', name: "Bachelor's degree (weekend)", description: 'Undergraduate degrees, weekend classes', category: 'BACHELORS' as const, mode: 'WEEKEND' as const, semesters: 12, indexFormat: 'ANU{YY}{CODE}{SEQ:5}' },
  // Diploma index numbers start with D and the programme's initials (DCE, DBM, DOE). What follows is to be confirmed by the Registry.
  { code: '2', name: 'Diploma', description: 'Index numbers start with the programme code, e.g. DCE', category: 'DIPLOMA' as const, mode: 'REGULAR' as const, semesters: 4, indexFormat: '{PROG}{YY}{SEQ:4}' },
  { code: '6', name: 'Graduate School', description: "Master's programmes. Index format to be confirmed by the Registry", category: 'GRADUATE' as const, mode: 'REGULAR' as const, semesters: 4, indexFormat: 'ANUGS{YY}{SEQ:4}' },
];

/** Demo students are spread over these programmes only, so adding programmes never moves them. */
export const DEMO_STUDENT_PROGRAMMES = ['BA-THE', 'BBA-ACC', 'BBA-MGT', 'BSC-BME', 'BSC-CS', 'BSC-EEE', 'BSC-NUR'];

/** Course codes encode the level: "CSC 203" is a 200-level course. Odd last digit = first semester. */
export const STRUCTURE = [
  {
    code: 'SET', name: 'School of Engineering and Technology',
    departments: [
      { code: 'CSC', name: 'Computer Science', programmes: [{ code: 'BSC-CS', name: 'BSc Computer Science' }, { code: 'BSC-CS-WKD', name: 'BSc Computer Science (Weekend)', level: 'W' }, { code: 'MSC-CS', name: 'MSc Computer Science', level: '6' }],
        courses: [['CSC 101', 'Introduction to Computing', 3], ['CSC 103', 'Programming Fundamentals', 3], ['CSC 102', 'Object-Oriented Programming', 3], ['CSC 201', 'Data Structures', 3], ['CSC 203', 'Computer Organisation', 3], ['CSC 205', 'Discrete Mathematics', 3]] },
      { code: 'EEE', name: 'Electrical and Electronic Engineering', programmes: [{ code: 'BSC-EEE', name: 'BSc Electronic and Communication Engineering' }, { code: 'BSC-CE', name: 'BSc Computer Engineering' }, { code: 'DIP-CE', name: 'Diploma in Computer Engineering', level: '2', indexCode: 'DCE' }],
        courses: [['EEE 101', 'Circuit Theory I', 3], ['EEE 103', 'Engineering Drawing', 2], ['EEE 201', 'Signals and Systems', 3], ['EEE 203', 'Electronics I', 3]] },
      { code: 'BME', name: 'Biomedical Engineering', programmes: [{ code: 'BSC-BME', name: 'BSc Biomedical Engineering' }, { code: 'DIP-BME', name: 'Diploma in Biomedical Engineering', level: '2', indexCode: 'DBM' }],
        courses: [['BME 101', 'Introduction to Biomedical Engineering', 3], ['BME 103', 'Engineering Mathematics I', 3], ['BME 201', 'Human Anatomy for Engineers', 3]] },
      { code: 'OGE', name: 'Oil and Gas Engineering', programmes: [{ code: 'DIP-OGE', name: 'Diploma in Oil and Gas Engineering', level: '2', indexCode: 'DOE' }], courses: [] },
    ],
  },
  {
    code: 'SBA', name: 'School of Business Administration',
    departments: [
      { code: 'ACC', name: 'Accounting and Finance', programmes: [{ code: 'BBA-ACC', name: 'BBA Accounting' }],
        courses: [['ACC 101', 'Principles of Accounting I', 3], ['ACC 103', 'Business Mathematics', 3], ['ACC 201', 'Intermediate Accounting', 3], ['ACC 203', 'Cost Accounting', 3]] },
      { code: 'MGT', name: 'Management Studies', programmes: [{ code: 'BBA-MGT', name: 'BBA Human Resource Management' }],
        courses: [['MGT 101', 'Principles of Management', 3], ['MGT 103', 'Introduction to Business', 3], ['MGT 201', 'Organisational Behaviour', 3]] },
    ],
  },
  {
    code: 'SHS', name: 'School of Humanities and Social Sciences',
    departments: [
      { code: 'THE', name: 'Theology and Missions', programmes: [{ code: 'BA-THE', name: 'BA Theology' }],
        courses: [['THE 101', 'Introduction to Biblical Studies', 3], ['THE 103', 'Old Testament Survey', 3], ['THE 201', 'Church History', 3]] },
      { code: 'NUR', name: 'Nursing', programmes: [{ code: 'BSC-NUR', name: 'BSc Nursing' }],
        courses: [['NUR 101', 'Foundations of Nursing', 3], ['NUR 103', 'Microbiology', 3], ['NUR 201', 'Anatomy and Physiology', 3]] },
      // University-wide courses; every programme's curriculum includes them.
      { code: 'GEN', name: 'Languages and General Studies', programmes: [],
        courses: [['GNS 101', 'Communication Skills I', 2], ['GNS 103', 'Introduction to Christian Faith', 2], ['GNS 201', 'Critical Thinking and Logic', 2]] },
    ],
  },
] as const;

export const GENERAL_STUDIES_DEPT = 'GEN';

export function courseLevel(code: string) {
  return Number(code.split(' ')[1][0]) * 100;
}

/** Odd final digit = first semester, even = second. */
export function courseSemester(code: string) {
  return Number(code.split(' ')[1].slice(-1)) % 2 === 1 ? 1 : 2;
}

export const DEMO_STAFF: Array<{ email: string; firstName: string; lastName: string; title: string; roles: RoleKey[]; dept?: string; teaching?: boolean }> = [
  { email: 'superadmin@demo.anu.edu.gh', firstName: 'Kwabena', lastName: 'Asante', title: 'Mr', roles: [ROLE_KEYS.SUPER_ADMIN] },
  { email: 'superadmin2@demo.anu.edu.gh', firstName: 'Efua', lastName: 'Boateng', title: 'Mrs', roles: [ROLE_KEYS.SUPER_ADMIN] },
  { email: 'registrar@demo.anu.edu.gh', firstName: 'Samuel', lastName: 'Ofori', title: 'Mr', roles: [ROLE_KEYS.REGISTRAR] },
  { email: 'exams@demo.anu.edu.gh', firstName: 'Grace', lastName: 'Mensah', title: 'Ms', roles: [ROLE_KEYS.EXAM_COORDINATOR] },
  { email: 'librarian@demo.anu.edu.gh', firstName: 'Abena', lastName: 'Owusu', title: 'Mrs', roles: [ROLE_KEYS.LIBRARIAN] },
  { email: 'hostels@demo.anu.edu.gh', firstName: 'Yaw', lastName: 'Darko', title: 'Mr', roles: [ROLE_KEYS.HOSTEL_MANAGER] },
  { email: 'lecturer.cs@demo.anu.edu.gh', firstName: 'Daniel', lastName: 'Agyeman', title: 'Dr', roles: [ROLE_KEYS.LECTURER, ROLE_KEYS.HEAD_OF_DEPARTMENT], dept: 'CSC', teaching: true },
  { email: 'lecturer.acc@demo.anu.edu.gh', firstName: 'Comfort', lastName: 'Adjei', title: 'Dr', roles: [ROLE_KEYS.LECTURER], dept: 'ACC', teaching: true },
  { email: 'advisor.cs@demo.anu.edu.gh', firstName: 'Mercy', lastName: 'Opoku', title: 'Dr', roles: [ROLE_KEYS.LECTURER, ROLE_KEYS.ACADEMIC_ADVISOR], dept: 'CSC', teaching: true },
  { email: 'coordinator.sba@demo.anu.edu.gh', firstName: 'Joseph', lastName: 'Antwi', title: 'Mr', roles: [ROLE_KEYS.PROGRAMME_COORDINATOR, ROLE_KEYS.LECTURER], dept: 'ACC', teaching: true },
  { email: 'finance@demo.anu.edu.gh', firstName: 'Rita', lastName: 'Asamoah', title: 'Mrs', roles: [ROLE_KEYS.FINANCE_OFFICER] },
  { email: 'deanofstudents@demo.anu.edu.gh', firstName: 'Francis', lastName: 'Nyarko', title: 'Rev', roles: [ROLE_KEYS.DEAN_OF_STUDENTS] },
  { email: 'health@demo.anu.edu.gh', firstName: 'Janet', lastName: 'Boakye', title: 'Ms', roles: [ROLE_KEYS.HEALTH_OFFICER] },
  { email: 'chaplaincy@demo.anu.edu.gh', firstName: 'Samuel', lastName: 'Kyei', title: 'Rev', roles: [ROLE_KEYS.CHAPLAINCY_OFFICER] },
  { email: 'hostels.security@demo.anu.edu.gh', firstName: 'Michael', lastName: 'Tetteh', title: 'Mr', roles: [ROLE_KEYS.SECURITY_OFFICER] },
  { email: 'careers@demo.anu.edu.gh', firstName: 'Gifty', lastName: 'Amoako', title: 'Mrs', roles: [ROLE_KEYS.CAREER_SERVICES_OFFICER] },
  { email: 'libdesk@demo.anu.edu.gh', firstName: 'Priscilla', lastName: 'Asiedu', title: 'Ms', roles: [ROLE_KEYS.LIBRARY_ASSISTANT] },
  { email: 'vc@demo.anu.edu.gh', firstName: 'Emmanuel', lastName: 'Kwarteng', title: 'Prof', roles: [ROLE_KEYS.VICE_CHANCELLOR] },
  { email: 'admissions@demo.anu.edu.gh', firstName: 'Linda', lastName: 'Sarpong', title: 'Mrs', roles: [ROLE_KEYS.ADMISSIONS_OFFICER] },
  { email: 'ict@demo.anu.edu.gh', firstName: 'Isaac', lastName: 'Boadu', title: 'Mr', roles: [ROLE_KEYS.ICT_SUPPORT] },
  { email: 'auditor@demo.anu.edu.gh', firstName: 'Patience', lastName: 'Ansah', title: 'Mrs', roles: [ROLE_KEYS.INTERNAL_AUDITOR] },
  { email: 'dev.candidate@demo.anu.edu.gh', firstName: 'Kofi', lastName: 'Amponsah', title: 'Mr', roles: [ROLE_KEYS.LECTURER], dept: 'CSC', teaching: true },
];

const FIRST = ['Ama', 'Kwame', 'Akosua', 'Kojo', 'Adwoa', 'Kwesi', 'Esi', 'Yaa', 'Nana', 'Fiifi', 'Afia', 'Kobby', 'Selasi', 'Delali', 'Elikem', 'Mawuli', 'Chioma', 'Tunde', 'Ifeoma', 'Emeka'];
const LAST = ['Appiah', 'Osei', 'Nkrumah', 'Addo', 'Quaye', 'Tetteh', 'Amoah', 'Frimpong', 'Gyamfi', 'Asamoah', 'Kumi', 'Agbeko', 'Okafor', 'Adeyemi', 'Nwosu'];

/** Demo first names with the gender usually associated with them in Ghana and Nigeria. */
const GENDER: Record<string, 'Female' | 'Male'> = {
  Ama: 'Female', Kwame: 'Male', Akosua: 'Female', Kojo: 'Male', Adwoa: 'Female', Kwesi: 'Male', Esi: 'Female', Yaa: 'Female', Nana: 'Female', Fiifi: 'Male',
  Afia: 'Female', Kobby: 'Male', Selasi: 'Female', Delali: 'Female', Elikem: 'Male', Mawuli: 'Male', Chioma: 'Female', Tunde: 'Male', Ifeoma: 'Female', Emeka: 'Male',
};

export function demoStudentName(i: number) {
  const firstName = FIRST[i % FIRST.length];
  return { firstName, lastName: LAST[(i * 7) % LAST.length], gender: GENDER[firstName] ?? 'Female' };
}

export function demoGender(firstName: string) {
  return GENDER[firstName] ?? null;
}

/**
 * Starting grading scale, common among Ghanaian universities. The Registry edits it in the app.
 * A band applies to totals at or above its minimum score, down to the next band.
 */
export const DEFAULT_GRADING_SCALE = {
  name: 'Undergraduate grading scale',
  passMark: 50,
  maxGradePoint: 4,
  bands: [
    { letter: 'A', minScore: 80, gradePoint: 4.0, isPass: true, remark: 'Excellent' },
    { letter: 'B+', minScore: 75, gradePoint: 3.5, isPass: true, remark: 'Very good' },
    { letter: 'B', minScore: 70, gradePoint: 3.0, isPass: true, remark: 'Good' },
    { letter: 'C+', minScore: 65, gradePoint: 2.5, isPass: true, remark: 'Fairly good' },
    { letter: 'C', minScore: 60, gradePoint: 2.0, isPass: true, remark: 'Average' },
    { letter: 'D+', minScore: 55, gradePoint: 1.5, isPass: true, remark: 'Below average' },
    { letter: 'D', minScore: 50, gradePoint: 1.0, isPass: true, remark: 'Pass' },
    { letter: 'F', minScore: 0, gradePoint: 0.0, isPass: false, remark: 'Fail' },
  ],
};

export const DEMO_VENUES = [
  { name: 'Main Auditorium', capacity: 300, location: 'Central campus' },
  { name: 'Engineering Block, Room E101', capacity: 60, location: 'School of Engineering and Technology' },
  { name: 'Business School Hall', capacity: 120, location: 'School of Business Administration' },
  { name: 'ICT Laboratory 2', capacity: 40, location: 'Library building, first floor' },
];

/** Demo university hostels. Rooms are generated from these ranges. */
export const DEMO_HOSTELS = [
  { name: 'Grace Hall', gender: 'FEMALE' as const, location: 'North campus', facilities: ['Reading room', 'Laundry', 'Wi-Fi'], rooms: { prefix: 'G', from: 101, to: 112, capacity: 4, roomType: '4 in a room', price: 150000 } },
  { name: 'Mercy Hall', gender: 'FEMALE' as const, location: 'North campus', facilities: ['Kitchenette', 'Wi-Fi'], rooms: { prefix: 'M', from: 201, to: 206, capacity: 2, roomType: '2 in a room', price: 220000 } },
  { name: 'Faith Hall', gender: 'MALE' as const, location: 'South campus', facilities: ['Reading room', 'Sports court', 'Wi-Fi'], rooms: { prefix: 'F', from: 101, to: 112, capacity: 4, roomType: '4 in a room', price: 150000 } },
  { name: 'Hope Hall', gender: 'MALE' as const, location: 'South campus', facilities: ['Kitchenette'], rooms: { prefix: 'H', from: 201, to: 206, capacity: 2, roomType: '2 in a room', price: 220000 } },
];

/** Demo catalogue: [title, authors, isbn, publisher, year, callNumber, subjects, copies, referenceCopies]. */
export const DEMO_BOOKS: Array<[string, string[], string, string, number, string, string[], number, number]> = [
  ['Introduction to Algorithms', ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'], '9780262046305', 'MIT Press', 2022, 'QA76.6 .C662', ['Algorithms', 'Computer science'], 3, 1],
  ['Computer Organization and Design', ['David A. Patterson', 'John L. Hennessy'], '9780128201091', 'Morgan Kaufmann', 2020, 'QA76.9 .C643', ['Computer architecture'], 2, 0],
  ['Discrete Mathematics and Its Applications', ['Kenneth H. Rosen'], '9781260091991', 'McGraw-Hill', 2018, 'QA39.3 .R67', ['Discrete mathematics'], 3, 0],
  ['Python Crash Course', ['Eric Matthes'], '9781718502703', 'No Starch Press', 2023, 'QA76.73 .P98', ['Programming', 'Python'], 4, 0],
  ['Clean Code', ['Robert C. Martin'], '9780132350884', 'Prentice Hall', 2008, 'QA76.76 .M37', ['Software engineering'], 1, 0],
  ['Fundamentals of Electric Circuits', ['Charles K. Alexander', 'Matthew N. O. Sadiku'], '9780078028229', 'McGraw-Hill', 2016, 'TK454 .A452', ['Electrical engineering', 'Circuits'], 2, 1],
  ['Signals and Systems', ['Alan V. Oppenheim', 'Alan S. Willsky'], '9780138147570', 'Prentice Hall', 1996, 'QA402 .O63', ['Signal processing'], 2, 0],
  ['Financial Accounting', ['Frank Wood', 'Alan Sangster'], '9781292365466', 'Pearson', 2021, 'HF5636 .W66', ['Accounting'], 4, 1],
  ['Management', ['Stephen P. Robbins', 'Mary Coulter'], '9780135581858', 'Pearson', 2020, 'HD31 .R5647', ['Management'], 3, 0],
  ['Organizational Behavior', ['Stephen P. Robbins', 'Timothy A. Judge'], '9780134729329', 'Pearson', 2018, 'HD58.7 .R62', ['Organizational behaviour'], 2, 0],
  ['Introducing the Old Testament', ['Tremper Longman III'], '9780310328537', 'Zondervan', 2012, 'BS1140.3 .L66', ['Bible', 'Old Testament'], 3, 0],
  ['Church History in Plain Language', ['Bruce L. Shelley'], '9780310115670', 'Zondervan', 2020, 'BR145.3 .S53', ['Church history'], 2, 0],
  ['Fundamentals of Nursing', ['Patricia A. Potter', 'Anne Griffin Perry'], '9780323810340', 'Elsevier', 2022, 'RT41 .F86', ['Nursing'], 3, 1],
  ['Microbiology: An Introduction', ['Gerard J. Tortora', 'Berdell R. Funke', 'Christine L. Case'], '9780135933176', 'Pearson', 2020, 'QR41.2 .T67', ['Microbiology'], 2, 0],
  ['They Say / I Say', ['Gerald Graff', 'Cathy Birkenstein'], '9780393538700', 'W. W. Norton', 2021, 'PE1431 .G73', ['Academic writing', 'Communication skills'], 5, 0],
];

const weekdays = (slots: Array<[string, string]>, saturday: Array<[string, string]> = []) =>
  ({ '0': [], '1': slots, '2': slots, '3': slots, '4': slots, '5': slots, '6': saturday }) as Record<string, Array<[string, string]>>;

/** Demo vendors. Prices in pesewas. */
export const DEMO_VENDORS = [
  {
    email: 'vendor@demo.anu.edu.gh', firstName: 'Akua', lastName: 'Sarfo', name: 'ANU Main Cafeteria', location: 'Student Centre, ground floor', phone: '233244000501',
    description: 'Hot meals every day, from breakfast to supper.',
    hours: weekdays([['07:00', '21:00']], [['09:00', '18:00']]),
    offersDelivery: true, deliveryFee: 500, deliveryNote: 'To university halls only.', minimumOrder: 1500, prepMinutes: 20, status: 'APPROVED' as const,
    payout: { network: 'MTN', number: '233244000501', name: 'ANU Main Cafeteria' },
    menu: {
      'Rice dishes': [['Jollof rice with chicken', 3500, ['Spicy']], ['Fried rice with chicken', 3500, []], ['Waakye special', 3000, ['Includes egg and wele']], ['Plain rice and stew', 2000, []]],
      'Local dishes': [['Banku and grilled tilapia', 5000, ['Spicy']], ['Red red with plantain', 2500, ['Vegetarian']], ['Kenkey and fried fish', 3000, []]],
      Drinks: [['Sobolo', 800, ['Vegetarian']], ['Bottled water (750 ml)', 400, []], ['Malt drink', 1000, []]],
    } as Record<string, Array<[string, number, string[]]>>,
  },
  {
    email: 'vendor2@demo.anu.edu.gh', firstName: 'Esi', lastName: 'Mensah', name: "Mama Esi's Kitchen", location: 'Behind Grace Hall', phone: '233244000502',
    description: 'Home-style cooking and snacks.',
    hours: weekdays([['11:00', '15:00'], ['17:00', '20:00']]),
    offersDelivery: false, deliveryFee: 0, deliveryNote: null, minimumOrder: 0, prepMinutes: 15, status: 'APPROVED' as const,
    payout: { network: 'Telecel', number: '233204000502', name: 'Esi Mensah' },
    menu: {
      Meals: [['Indomie with egg', 2000, []], ['Beans and gari', 1500, ['Vegetarian']], ['Fufu and light soup with goat', 4500, ['Spicy']]],
      Snacks: [['Kelewele', 1000, ['Vegetarian', 'Spicy']], ['Meat pie', 800, []], ['Bofrot (4 pieces)', 500, ['Vegetarian']]],
    } as Record<string, Array<[string, number, string[]]>>,
  },
  {
    email: 'vendor3@demo.anu.edu.gh', firstName: 'Kofi', lastName: 'Adu', name: 'Campus Snacks Kiosk', location: 'Near the library', phone: '233244000503',
    description: 'Pastries, drinks and quick bites.',
    hours: weekdays([['08:00', '18:00']]),
    offersDelivery: false, deliveryFee: 0, deliveryNote: null, minimumOrder: 0, prepMinutes: 5, status: 'PENDING' as const,
    payout: null,
    menu: { Snacks: [['Sausage roll', 700, []], ['Chilled yoghurt', 900, []]] } as Record<string, Array<[string, number, string[]]>>,
  },
];
