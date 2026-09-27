/**
 * Index number format: ANU + 2-digit admission year + programme level code + 5-digit sequence.
 * Example: a degree student (level code 4) admitted in 2025, first in sequence -> ANU25400001.
 */
export const INDEX_SEQUENCE_DIGITS = 5;
export const INDEX_SEQUENCE_MAX = 10 ** INDEX_SEQUENCE_DIGITS - 1;

export function formatIndexNumber(admissionYear: number, levelCode: string, sequence: number): string {
  if (!Number.isInteger(admissionYear) || admissionYear < 2000 || admissionYear > 2099) {
    throw new Error('Admission year must be between 2000 and 2099.');
  }
  if (!/^[0-9A-Z]{1,3}$/.test(levelCode)) throw new Error('Level code must be 1 to 3 characters, digits or capital letters.');
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > INDEX_SEQUENCE_MAX) {
    throw new Error(`Index sequence for ${admissionYear}/${levelCode} is exhausted.`);
  }
  const yy = String(admissionYear % 100).padStart(2, '0');
  return `ANU${yy}${levelCode}${String(sequence).padStart(INDEX_SEQUENCE_DIGITS, '0')}`;
}
