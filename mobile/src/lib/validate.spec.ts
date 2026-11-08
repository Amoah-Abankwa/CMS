import { validate } from './validate';

describe('sign-in field checks', () => {
  it('accepts good values', () => {
    expect(validate.indexNumber('ANU25400001')).toBe(null);
    expect(validate.indexNumber('DCE260001')).toBe(null);
    expect(validate.email('kofi@anu.edu.gh')).toBe(null);
    expect(validate.code('123456')).toBe(null);
  });
  it('says how to fix bad values', () => {
    expect(validate.indexNumber('ANU 2540')).toMatch('for example ANU25400001');
    expect(validate.email('kofi@anu')).toMatch('name@anu.edu.gh');
    expect(validate.code('12345')).toMatch('6-digit');
  });
});
