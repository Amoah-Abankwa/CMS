import { didYouMean, editDistance, matches, vocabulary } from './search';

describe('search help', () => {
  const words = vocabulary(['CSC 201 Data Structures and Algorithms', 'MTH 101 Mathematics I', 'GNS 101 Communication Skills']);
  it('measures how far apart two words are', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });
  it('fixes a typo from the words that exist', () => {
    expect(didYouMean('algorthms', words)).toBe('algorithms');
    expect(didYouMean('mathematcs', words)).toBe('mathematics');
  });
  it('leaves good or unknowable searches alone', () => {
    expect(didYouMean('data', words)).toBe(null);
    expect(didYouMean('chemistry', words)).toBe(null);
  });
  it('matches every word of the search', () => {
    expect(matches('CSC 201 Data Structures', 'csc data')).toBe(true);
    expect(matches('CSC 201 Data Structures', 'csc maths')).toBe(false);
  });
});
