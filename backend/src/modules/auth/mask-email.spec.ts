import { maskEmail } from './mask-email';

describe('masking the email a sign-in code is sent to', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('kofi.boateng@anu.edu.gh')).toBe('k******@anu.edu.gh');
    expect(maskEmail('ab@anu.edu.gh')).toBe('a**@anu.edu.gh');
  });
});
