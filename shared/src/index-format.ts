/**
 * Index number formats, set by the Registrar for each programme type. A format is literal capital
 * letters, digits, "/" or "-", plus tokens:
 *   {YY}    two-digit admission year        {YYYY}  four-digit admission year
 *   {CODE}  the programme type's code       {PROG}  the programme's own index code (e.g. DCE)
 *   {SEQ:n} running number, n digits (3 to 6), exactly once, at the end
 * Examples: ANU{YY}{CODE}{SEQ:5} gives ANU25400001; ANUGS{YY}{SEQ:4} gives ANUGS250001;
 * {PROG}{YY}{SEQ:4} gives DCE260001 for Diploma in Computer Engineering.
 */
const TOKEN = /\{(YY|YYYY|CODE|PROG|SEQ:(\d))\}/g;

export const DEFAULT_INDEX_FORMAT = 'ANU{YY}{CODE}{SEQ:5}';

export function validateIndexFormat(format: string): string[] {
  const problems: string[] = [];
  const literal = format.replace(TOKEN, '');
  if (/[^A-Z0-9/-]/.test(literal)) problems.push('Use only capital letters, digits, "/" and "-" outside the {…} parts.');
  const unknown = format.replace(TOKEN, '').match(/\{[^}]*\}?/g);
  if (unknown) problems.push(`Unknown part ${unknown[0]}. Use {YY}, {YYYY}, {CODE}, {PROG} and {SEQ:n}.`);
  const seqs = [...format.matchAll(/\{SEQ:(\d)\}/g)];
  if (seqs.length !== 1) problems.push('Include the running number exactly once, as {SEQ:5} (3 to 6 digits).');
  else {
    const n = Number(seqs[0][1]);
    if (n < 3 || n > 6) problems.push('The running number must have 3 to 6 digits.');
    if (!format.endsWith(seqs[0][0])) problems.push('Put the running number at the end, so index numbers sort in order.');
  }
  if (!/\{YY(YY)?\}/.test(format)) problems.push('Include the admission year, as {YY} or {YYYY}, so numbers do not repeat across years.');
  // The number itself must start with a letter; {PROG} codes always do.
  const sample = safeRender(format, 2026, 'XXX', 1, 'DCE');
  if (!/^[A-Z]/.test(sample ?? format)) problems.push('Index numbers must start with a letter: begin with letters such as ANU, or with {PROG}.');
  if (sample && sample.length > 20) problems.push('Index numbers can be at most 20 characters.');
  return problems;
}

function safeRender(format: string, year: number, code: string, seq: number, programmeCode: string) {
  try { return renderIndexNumber(format, { year, code, sequence: seq, programmeCode }); } catch { return null; }
}

/** Whether each programme of this type needs its own index code. */
export function usesProgrammeCode(format: string) {
  return format.includes('{PROG}');
}

/** A programme's index code, such as DCE: 2 to 6 capital letters or digits, starting with a letter. */
export const PROGRAMME_INDEX_CODE = /^[A-Z][A-Z0-9]{1,5}$/;

/** A starting suggestion from the programme's name: "Diploma in Computer Engineering" gives DCE. The Registrar can change it (BM for Biomedical, say). */
export function suggestIndexCode(name: string) {
  const words = name.replace(/\(.*?\)/g, '').split(/[^A-Za-z]+/).filter((w) => w && !/^(in|of|and|the|for|with|&)$/i.test(w));
  return words.map((w) => w[0].toUpperCase()).join('').slice(0, 6);
}

/** Everything except the running number: the key for the counter, so different formats never share numbers wrongly. */
export function indexPrefix(format: string, year: number, code: string, programmeCode?: string | null) {
  if (usesProgrammeCode(format) && !programmeCode) throw new Error('This programme needs an index code (for example DCE) because its type\'s index format uses {PROG}.');
  return format.replace(/\{SEQ:\d\}$/, '').replace('{YYYY}', String(year)).replace('{YY}', String(year % 100).padStart(2, '0')).replace('{CODE}', code).replace('{PROG}', programmeCode ?? '');
}

export function indexSequenceDigits(format: string) {
  return Number(/\{SEQ:(\d)\}/.exec(format)?.[1] ?? 5);
}

export function renderIndexNumber(format: string, v: { year: number; code: string; sequence: number; programmeCode?: string | null }) {
  if (!Number.isInteger(v.year) || v.year < 2000 || v.year > 2099) throw new Error('Admission year must be between 2000 and 2099.');
  const digits = indexSequenceDigits(format);
  if (!Number.isInteger(v.sequence) || v.sequence < 1 || v.sequence >= 10 ** digits) throw new Error(`The running number for ${indexPrefix(format, v.year, v.code, v.programmeCode)} is used up; lengthen {SEQ} in the format.`);
  return indexPrefix(format, v.year, v.code, v.programmeCode) + String(v.sequence).padStart(digits, '0');
}

/** What students type to sign in: any format the Registrar may set. */
export const INDEX_NUMBER_INPUT = /^[A-Z][A-Z0-9/-]{5,19}$/;
