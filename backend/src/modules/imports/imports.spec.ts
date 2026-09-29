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
