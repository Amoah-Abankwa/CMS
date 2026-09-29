import { isLoopback, normaliseIp, parseTrustProxy } from './client-ip';

describe("visitors' IP addresses", () => {
  it('reads TRUST_PROXY as a hop count or a list of addresses', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
    expect(parseTrustProxy('false')).toBe(false);
  });
  it('stores IPv4 addresses plainly', () => {
    expect(normaliseIp('::ffff:41.66.2.10')).toBe('41.66.2.10');
    expect(normaliseIp('2c0f:fe38::1')).toBe('2c0f:fe38::1');
  });
  it('recognises this-computer addresses', () => {
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('41.66.2.10')).toBe(false);
  });
});
