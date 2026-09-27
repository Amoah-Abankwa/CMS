import { csvCell } from '../../frontend/src/lib/csv';

describe('CSV exports', () => {
  it('stops spreadsheet formulas typed into names or notes', () => {
    expect(csvCell('=HYPERLINK("http://x","click")')).toBe(`"'=HYPERLINK(""http://x"",""click"")"`);
    expect(csvCell('+233244000000')).toBe("'+233244000000");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('quotes commas, quotes and new lines, and leaves plain text and numbers alone', () => {
    expect(csvCell('Grace Hall, room G14')).toBe('"Grace Hall, room G14"');
    expect(csvCell('Kofi "KK" Mensah')).toBe('"Kofi ""KK"" Mensah"');
    expect(csvCell('Ama Owusu')).toBe('Ama Owusu');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});
