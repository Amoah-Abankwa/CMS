/**
 * Importing data from the university's previous system: CSV parsing, matching column headings to our
 * fields, and small converters. The server checks every row again before saving anything.
 */

/** Parses CSV as Excel saves it: quoted fields, commas and line breaks inside quotes, "" for a quote, BOM. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

export type ImportType = 'STRUCTURE' | 'COURSES' | 'STAFF' | 'STUDENTS' | 'RESULTS';

export interface ImportField { key: string; label: string; required?: boolean; aliases: string[] }

/** Our fields for each import, with headings other systems commonly use for them. */
export const IMPORT_FIELDS: Record<ImportType, ImportField[]> = {
  STRUCTURE: [
    { key: 'schoolCode', label: 'School code', required: true, aliases: ['faculty code', 'school'] },
    { key: 'schoolName', label: 'School name', aliases: ['faculty', 'faculty name'] },
    { key: 'departmentCode', label: 'Department code', required: true, aliases: ['dept code', 'dept', 'department'] },
    { key: 'departmentName', label: 'Department name', aliases: ['dept name'] },
    { key: 'programmeCode', label: 'Programme code', required: true, aliases: ['program code', 'programme', 'program', 'course of study code'] },
    { key: 'programmeName', label: 'Programme name', required: true, aliases: ['program name', 'course of study', 'programme title'] },
    { key: 'programmeType', label: 'Programme type code', required: true, aliases: ['level code', 'type', 'programme type', 'award'] },
    { key: 'indexCode', label: 'Index code (e.g. DCE)', aliases: ['index prefix'] },
  ],
  COURSES: [
    { key: 'code', label: 'Course code', required: true, aliases: ['course code', 'course', 'module code'] },
    { key: 'title', label: 'Title', required: true, aliases: ['course title', 'course name', 'name', 'module title'] },
    { key: 'credits', label: 'Credit hours', required: true, aliases: ['credit', 'credit hours', 'units', 'cr'] },
    { key: 'departmentCode', label: 'Department code', required: true, aliases: ['dept code', 'dept', 'department'] },
    { key: 'programmeCode', label: 'Programme code (curriculum)', aliases: ['program code', 'programme'] },
    { key: 'level', label: 'Level (100, 200...)', aliases: ['year', 'level'] },
    { key: 'semester', label: 'Semester in the year (1 Fall, 2 Spring, 3 Summer for weekend)', aliases: ['sem', 'semester no'] },
    { key: 'elective', label: 'Elective (yes/no)', aliases: ['elective', 'optional'] },
  ],
  STAFF: [
    { key: 'email', label: 'Email', required: true, aliases: ['email address', 'e-mail', 'official email'] },
    { key: 'title', label: 'Title', aliases: ['salutation'] },
    { key: 'firstName', label: 'First name', required: true, aliases: ['first name', 'firstname', 'given name', 'other names'] },
    { key: 'middleName', label: 'Middle name', aliases: ['middle name', 'middlename'] },
    { key: 'lastName', label: 'Surname', required: true, aliases: ['last name', 'lastname', 'surname', 'family name'] },
    { key: 'phone', label: 'Phone', aliases: ['phone number', 'mobile', 'telephone', 'contact'] },
    { key: 'staffId', label: 'Staff ID (needed for new staff)', aliases: ['staff no', 'staff number', 'employee id', 'employee no'] },
    { key: 'departmentCode', label: 'Department code', aliases: ['dept code', 'dept', 'department'] },
    { key: 'roles', label: 'Roles (separated by ;)', aliases: ['role', 'position', 'roles'] },
  ],
  STUDENTS: [
    { key: 'indexNumber', label: 'Index number', required: true, aliases: ['index no', 'index', 'student id', 'student no', 'matric no', 'reg no', 'registration number'] },
    { key: 'firstName', label: 'First name', required: true, aliases: ['first name', 'firstname', 'given name', 'other names'] },
    { key: 'middleName', label: 'Middle name', aliases: ['middle name', 'middlename'] },
    { key: 'lastName', label: 'Surname', required: true, aliases: ['last name', 'lastname', 'surname', 'family name'] },
    { key: 'email', label: 'Email', aliases: ['email address', 'e-mail', 'personal email'] },
    { key: 'phone', label: 'Phone', aliases: ['phone number', 'mobile', 'telephone', 'contact'] },
    { key: 'programmeCode', label: 'Programme code', required: true, aliases: ['program code', 'programme', 'program', 'course of study code'] },
    { key: 'currentLevel', label: 'Current level (100, 200...)', required: true, aliases: ['level', 'year', 'current level'] },
    { key: 'admissionYear', label: 'Year admitted', required: true, aliases: ['admission year', 'year of admission', 'entry year', 'intake'] },
    { key: 'gender', label: 'Gender', aliases: ['sex'] },
    { key: 'dateOfBirth', label: 'Date of birth', aliases: ['dob', 'birth date', 'date of birth'] },
    { key: 'nationality', label: 'Nationality', aliases: ['country', 'citizenship'] },
    { key: 'status', label: 'Status (active, graduated, withdrawn)', aliases: ['student status', 'status'] },
    { key: 'cmsId', label: 'ID in the old system', aliases: ['id', 'student ref', 'old id', 'cms id'] },
  ],
  RESULTS: [
    { key: 'indexNumber', label: 'Index number', required: true, aliases: ['index no', 'index', 'student id', 'student no', 'matric no'] },
    { key: 'courseCode', label: 'Course code', required: true, aliases: ['course code', 'course', 'module code'] },
    { key: 'academicYear', label: 'Academic year (2023/2024)', required: true, aliases: ['academic year', 'session', 'year'] },
    { key: 'semester', label: 'Semester (1 or 2)', required: true, aliases: ['sem', 'semester'] },
    { key: 'score', label: 'Total score (0 to 100)', aliases: ['total', 'mark', 'marks', 'total score'] },
    { key: 'grade', label: 'Grade', aliases: ['letter grade', 'grade'] },
  ],
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Suggests which column each field comes from, by heading. Returns field key to column index. */
export function matchColumns(type: ImportType, headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const used = new Set<number>();
  for (const f of IMPORT_FIELDS[type]) {
    const names = [f.key, f.label, ...f.aliases].map(norm);
    const i = headers.findIndex((h, idx) => !used.has(idx) && names.includes(norm(h)));
    if (i >= 0) { out[f.key] = i; used.add(i); }
  }
  return out;
}

/** Dates as 2004-03-21, 21/03/2004 or 21-03-2004 (day first, as in Ghana). */
export function parseImportDate(v: string): string | null {
  const s = v.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null;
}

export function parseGender(v: string): 'MALE' | 'FEMALE' | null {
  const s = v.trim().toLowerCase();
  if (['m', 'male', 'man', 'boy'].includes(s)) return 'MALE';
  if (['f', 'female', 'woman', 'girl'].includes(s)) return 'FEMALE';
  return null;
}

/** "2023/2024", "2023-2024", "2023/24" all give 2023/2024. */
export function parseAcademicYear(v: string): string | null {
  const r = /^(\d{4})\s*[/-]\s*(\d{2}|\d{4})$/.exec(v.trim());
  if (!r) return null;
  const start = Number(r[1]);
  const end = r[2].length === 2 ? Math.floor(start / 100) * 100 + Number(r[2]) : Number(r[2]);
  return end === start + 1 ? `${start}/${end}` : null;
}

/** Level as 100/200/... or 1/2/...; returns 100, 200, ... */
export function parseLevel(v: string): number | null {
  const n = Number(v.trim().replace(/^L(evel)?\s*/i, ''));
  if (!Number.isInteger(n)) return null;
  const level = n < 10 ? n * 100 : n;
  return level >= 100 && level <= 900 && level % 100 === 0 ? level : null;
}

// ----- Academic calendar (used by the Registrar's screen as well as imports) -----

const day = (d: string | Date) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Problems with a new academic year: label like 2026/2027, dates in order, starting in the label's first year. */
export function academicYearProblem(label: string, startDate: string, endDate: string): string | null {
  const l = parseAcademicYear(label);
  if (!l || l !== label.trim()) return 'Write the year as 2026/2027.';
  if (!(day(endDate) > day(startDate))) return 'The year must end after it starts.';
  if (Number(day(startDate).slice(0, 4)) !== Number(l.slice(0, 4))) return `${l} should start in ${l.slice(0, 4)}.`;
  return null;
}

/** Problems with a semester's dates: inside its academic year, in order, and not overlapping its other semesters. */
export function semesterDatesProblem(
  year: { startDate: string | Date; endDate: string | Date },
  s: { number: number; startDate: string; endDate: string },
  others: Array<{ number: number; startDate: string | Date; endDate: string | Date }>,
): string | null {
  if (!Number.isInteger(s.number) || s.number < 1 || s.number > 3) return 'The semester number must be 1, 2 or 3.';
  if (others.some((o) => o.number === s.number)) return `Semester ${s.number} already exists in this year.`;
  if (!(day(s.endDate) > day(s.startDate))) return 'The semester must end after it starts.';
  if (day(s.startDate) < day(year.startDate) || day(s.endDate) > day(year.endDate)) return 'The semester must fall within its academic year.';
  const clash = others.find((o) => day(s.startDate) <= day(o.endDate) && day(o.startDate) <= day(s.endDate));
  if (clash) return `It overlaps Semester ${clash.number}.`;
  return null;
}
