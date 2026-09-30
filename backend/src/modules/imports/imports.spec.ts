import { matchColumns, parseAcademicYear, parseCsv, parseGender, parseImportDate, parseLevel } from '@anu/shared';

describe('reading CSV files saved from Excel', () => {
  it('handles quotes, commas and line breaks inside quotes, and the BOM', () => {
    const rows = parseCsv('\uFEFFIndex No,Surname,Address\r\nANU20400001,"Mensah, Jr","Line 1\nLine 2"\r\nANU20400002,"Say ""hi""",\r\n\r\n');
    expect(rows).toEqual([['Index No', 'Surname', 'Address'], ['ANU20400001', 'Mensah, Jr', 'Line 1\nLine 2'], ['ANU20400002', 'Say "hi"', '']]);
  });
  it('matches column headings to our fields', () => {
    const m = matchColumns('STUDENTS', ['Student ID', 'Surname', 'Other Names', 'Programme Code', 'Level', 'Admission Year', 'Sex']);
    expect(m).toMatchObject({ indexNumber: 0, lastName: 1, firstName: 2, programmeCode: 3, currentLevel: 4, admissionYear: 5, gender: 6 });
  });
});

describe('converting values', () => {
  it('reads dates day first, and rejects impossible ones', () => {
    expect(parseImportDate('21/03/2004')).toBe('2004-03-21');
    expect(parseImportDate('2004-03-21')).toBe('2004-03-21');
    expect(parseImportDate('31/02/2004')).toBeNull();
  });
  it('reads gender, academic years and levels', () => {
    expect(parseGender('F')).toBe('FEMALE');
    expect(parseGender('x')).toBeNull();
    expect(parseAcademicYear('2023/24')).toBe('2023/2024');
    expect(parseAcademicYear('2023-2025')).toBeNull();
    expect(parseLevel('2')).toBe(200);
    expect(parseLevel('L300')).toBe(300);
    expect(parseLevel('250')).toBeNull();
  });
});

import { academicYearProblem, semesterDatesProblem } from '@anu/shared';

describe('academic calendar', () => {
  it('checks a new academic year', () => {
    expect(academicYearProblem('2026/2027', '2026-08-31', '2027-07-31')).toBeNull();
    expect(academicYearProblem('2026-27', '2026-08-31', '2027-07-31')).toMatch('2026/2027');
    expect(academicYearProblem('2026/2027', '2027-07-31', '2026-08-31')).toMatch('end after');
    expect(academicYearProblem('2026/2027', '2025-09-01', '2027-07-31')).toMatch('start in 2026');
  });
  it('keeps semesters inside the year and apart from each other', () => {
    const year = { startDate: '2026-08-31', endDate: '2027-07-31' };
    const first = { number: 1, startDate: '2026-09-07', endDate: '2027-01-15' };
    expect(semesterDatesProblem(year, first, [])).toBeNull();
    expect(semesterDatesProblem(year, { number: 2, startDate: '2027-01-10', endDate: '2027-05-30' }, [first])).toMatch('overlaps Semester 1');
    expect(semesterDatesProblem(year, { number: 2, startDate: '2027-01-25', endDate: '2027-08-30' }, [first])).toMatch('within');
    expect(semesterDatesProblem(year, { number: 1, startDate: '2027-01-25', endDate: '2027-05-30' }, [first])).toMatch('already exists');
    expect(semesterDatesProblem(year, { number: 2, startDate: '2027-01-25', endDate: '2027-05-30' }, [first])).toBeNull();
  });
});