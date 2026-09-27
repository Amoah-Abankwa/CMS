import { base32Decode, totp } from './totp';

// RFC 6238 appendix B test vectors (SHA-1, 8 digits, key "12345678901234567890").
const key = Buffer.from('12345678901234567890');
describe('authenticator codes used by the smoke test', () => {
  it('matches the RFC 6238 test vectors', () => {
    expect(totp(key, 59_000, 8)).toBe('94287082');
    expect(totp(key, 1_111_111_109_000, 8)).toBe('07081804');
    expect(totp(key, 1_234_567_890_000, 8)).toBe('89005924');
    expect(totp(key, 20_000_000_000_000, 8)).toBe('65353130');
  });
  it('decodes base32 secrets', () => {
    expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').toString()).toBe('12345678901234567890');
  });
});
