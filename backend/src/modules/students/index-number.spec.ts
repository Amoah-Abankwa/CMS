import { formatIndexNumber } from './index-number';

describe('formatIndexNumber', () => {
  it('formats the first degree student of 2025 as ANU25400001', () => {
    expect(formatIndexNumber(2025, '4', 1)).toBe('ANU25400001');
  });

  it('pads the sequence to five digits', () => {
    expect(formatIndexNumber(2026, '4', 1234)).toBe('ANU26401234');
  });

  it('supports other level codes', () => {
    expect(formatIndexNumber(2025, '6', 7)).toBe('ANU25600007');
  });

  it('rejects an exhausted sequence', () => {
    expect(() => formatIndexNumber(2025, '4', 100000)).toThrow(/exhausted/);
  });

  it('rejects invalid level codes', () => {
    expect(() => formatIndexNumber(2025, 'x!', 1)).toThrow();
  });
});
