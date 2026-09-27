export interface SmsProvider {
  send(to: string, message: string): Promise<{ providerMessageId?: string }>;
}

/** Normalises Ghana numbers to international format without "+", e.g. 0241234567 -> 233241234567. */
export function normaliseGhanaPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  throw new Error('Enter a valid Ghana phone number, for example 024 123 4567.');
}
