import { DEFAULT_INDEX_FORMAT, INDEX_NUMBER_INPUT, indexPrefix, renderIndexNumber, validateIndexFormat } from '@anu/shared';

describe('index number formats set by the Registrar', () => {
  it('keeps existing numbers exactly as they are', () => {
    expect(renderIndexNumber(DEFAULT_INDEX_FORMAT, { year: 2025, code: '4', sequence: 1 })).toBe('ANU25400001');
  });
  it('supports a different pattern for the Graduate School', () => {
    expect(renderIndexNumber('ANUGS{YY}{SEQ:4}', { year: 2026, code: '6', sequence: 12 })).toBe('ANUGS260012');
    expect(renderIndexNumber('ANU/{YYYY}/D{SEQ:3}', { year: 2026, code: '2', sequence: 7 })).toBe('ANU/2026/D007');
  });
  it('keys the counter by everything but the running number', () => {
    expect(indexPrefix('ANUGS{YY}{SEQ:4}', 2026, '6')).toBe('ANUGS26');
    expect(indexPrefix(DEFAULT_INDEX_FORMAT, 2026, 'W')).toBe('ANU26W');
  });
  it('refuses formats that could repeat, clash or be too long', () => {
    expect(validateIndexFormat(DEFAULT_INDEX_FORMAT)).toEqual([]);
    expect(validateIndexFormat('ANUGS{YY}{SEQ:4}')).toEqual([]);
    expect(validateIndexFormat('ANU{CODE}{SEQ:5}').length).toBeGreaterThan(0);
    expect(validateIndexFormat('ANU{YY}').length).toBeGreaterThan(0);
    expect(validateIndexFormat('ANU{YY}{SEQ:5}{CODE}').length).toBeGreaterThan(0);
    expect(validateIndexFormat('anu{YY}{SEQ:5}').length).toBeGreaterThan(0);
    expect(validateIndexFormat('ANU{YY}{MONTH}{SEQ:5}').length).toBeGreaterThan(0);
    expect(validateIndexFormat('ANU{YY}{SEQ:9}').length).toBeGreaterThan(0);
    expect(validateIndexFormat('ALLNATIONSUNIV{YYYY}{SEQ:6}').length).toBeGreaterThan(0);
  });
  it('refuses a running number that has run out', () => {
    expect(() => renderIndexNumber('ANU{YY}{SEQ:3}', { year: 2026, code: '4', sequence: 1000 })).toThrow('used up');
  });
  it('lets students sign in with any configured format', () => {
    for (const n of ['ANU25400001', 'ANUGS260012', 'ANU/2026/D007']) expect(INDEX_NUMBER_INPUT.test(n)).toBe(true);
    expect(INDEX_NUMBER_INPUT.test('anu25')).toBe(false);
  });
});

import { suggestIndexCode, usesProgrammeCode } from '@anu/shared';

describe('diploma index numbers from programme initials', () => {
  const format = '{PROG}{YY}{SEQ:4}';
  it('starts with the programme index code', () => {
    expect(validateIndexFormat(format)).toEqual([]);
    expect(usesProgrammeCode(format)).toBe(true);
    expect(renderIndexNumber(format, { year: 2026, code: '2', sequence: 1, programmeCode: 'DCE' })).toBe('DCE260001');
    expect(renderIndexNumber(format, { year: 2026, code: '2', sequence: 37, programmeCode: 'DBM' })).toBe('DBM260037');
  });
  it('keeps a separate sequence for each programme', () => {
    expect(indexPrefix(format, 2026, '2', 'DCE')).toBe('DCE26');
    expect(indexPrefix(format, 2026, '2', 'DOE')).toBe('DOE26');
  });
  it('refuses to number a student whose programme has no index code', () => {
    expect(() => renderIndexNumber(format, { year: 2026, code: '2', sequence: 1 })).toThrow('needs an index code');
  });
  it('still needs the number to start with a letter', () => {
    expect(validateIndexFormat('{YY}{SEQ:5}').length).toBeGreaterThan(0);
  });
  it('suggests initials from the programme name', () => {
    expect(suggestIndexCode('Diploma in Computer Engineering')).toBe('DCE');
    expect(suggestIndexCode('Diploma in Oil and Gas Engineering')).toBe('DOGE');
  });
});
