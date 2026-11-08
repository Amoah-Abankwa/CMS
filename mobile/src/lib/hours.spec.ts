import { hoursToText, parseDay } from './hours';

describe('opening hours as text', () => {
  it('reads one or more periods, or closed', () => {
    expect(parseDay('07:00-15:00').periods).toEqual([['07:00', '15:00']]);
    expect(parseDay('07:00-11:00, 16:00-21:00').periods).toEqual([['07:00', '11:00'], ['16:00', '21:00']]);
    expect(parseDay('').periods).toEqual([]);
  });
  it('says how to fix a wrong time', () => {
    expect(parseDay('7am-3pm').problem).toMatch('07:00-15:00');
    expect(parseDay('15:00-07:00').problem).toMatch('closing must be after opening');
  });
  it('writes the stored hours back', () => {
    expect(hoursToText({ '1': [['07:00', '15:00']] }, 1)).toBe('07:00-15:00');
    expect(hoursToText({}, 0)).toBe('');
  });
});
