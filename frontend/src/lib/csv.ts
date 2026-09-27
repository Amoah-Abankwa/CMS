type Cell = unknown;

/**
 * Quotes a cell for CSV. Text starting with = + - @ is prefixed with an apostrophe so a spreadsheet
 * does not run it as a formula (names and notes here can be typed by outside partners).
 */
export function csvCell(value: Cell) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  const text = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  // The byte order mark makes Excel read GH₵ and accented names correctly.
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
