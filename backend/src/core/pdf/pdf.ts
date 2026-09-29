import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

/**
 * Small server-side PDF builder for receipts and statements (A4, the university letterhead, key and
 * value rows, and tables that continue onto new pages). Embeds DejaVu Sans (assets/fonts, free licence)
 * so the cedi sign and accented names print as they are; if the font cannot be loaded it falls back to
 * the PDF standard fonts and writes money as GHS / USD.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FONT_DIRS = [resolve(process.cwd(), 'assets/fonts'), resolve(process.cwd(), 'backend/assets/fonts'), resolve(__dirname, '../../../assets/fonts'), resolve(__dirname, '../../../../assets/fonts')];
let fontCache: { regular: Buffer; bold: Buffer; fontkit: unknown } | null | undefined;
function loadFonts() {
  if (fontCache !== undefined) return fontCache;
  try {
    const dir = FONT_DIRS.find((d) => existsSync(resolve(d, 'DejaVuSans.ttf')));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fontkit = require('@pdf-lib/fontkit');
    fontCache = dir ? { regular: readFileSync(resolve(dir, 'DejaVuSans.ttf')), bold: readFileSync(resolve(dir, 'DejaVuSans-Bold.ttf')), fontkit: fontkit.default ?? fontkit } : null;
  } catch {
    fontCache = null;
  }
  return fontCache;
}
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;

/** Text the standard fonts can draw: the cedi sign becomes GHS, anything else unsupported becomes '?'. */
export function pdfSafe(text: string) {
  return text.replace(/GH₵/g, 'GHS').replace(/₵/g, 'GHS').replace(/US\$/g, 'USD').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

export class PdfDoc {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private font!: PDFFont;
  private bold!: PDFFont;
  private y = 0;
  private unicode = false;
  /** Text as it can be drawn: everything with the embedded font, a safe subset with the standard fonts. */
  private t(text: string) {
    return this.unicode ? text.replace(/[\u0000-\u001f]/g, ' ') : pdfSafe(text);
  }

  static async create(title: string, subtitle?: string) {
    const d = new PdfDoc();
    d.doc = await PDFDocument.create();
    d.doc.setTitle(pdfSafe(title));
    d.doc.setAuthor('All Nations University');
    const fonts = loadFonts();
    if (fonts) {
      d.doc.registerFontkit(fonts.fontkit as never);
      d.font = await d.doc.embedFont(fonts.regular, { subset: true });
      d.bold = await d.doc.embedFont(fonts.bold, { subset: true });
      d.unicode = true;
    } else {
      d.font = await d.doc.embedFont(StandardFonts.Helvetica);
      d.bold = await d.doc.embedFont(StandardFonts.HelveticaBold);
    }
    d.newPage();
    d.text('All Nations University', { size: 16, bold: true });
    d.text('Koforidua, Ghana', { size: 9 });
    d.gap(10);
    d.text(title, { size: 13, bold: true });
    if (subtitle) d.text(subtitle, { size: 10 });
    d.rule();
    return d;
  }

  private newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + 20) this.newPage();
  }

  gap(n = 8) {
    this.y -= n;
  }

  text(t: string, o: { size?: number; bold?: boolean; x?: number } = {}) {
    const size = o.size ?? 10;
    this.ensure(size + 4);
    this.page.drawText(this.t(t), { x: o.x ?? MARGIN, y: this.y - size, size, font: o.bold ? this.bold : this.font, color: rgb(0, 0, 0) });
    this.y -= size + 4;
  }

  rule() {
    this.ensure(10);
    this.y -= 4;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.7, color: rgb(0.3, 0.3, 0.3) });
    this.y -= 8;
  }

  /** Label and value pairs, one per line. */
  rows(pairs: Array<[string, string]>) {
    for (const [k, v] of pairs) {
      this.ensure(14);
      this.page.drawText(this.t(k), { x: MARGIN, y: this.y - 10, size: 10, font: this.font, color: rgb(0.35, 0.35, 0.35) });
      this.page.drawText(this.t(v), { x: MARGIN + 170, y: this.y - 10, size: 10, font: this.bold });
      this.y -= 16;
    }
  }

  /** A table; widths are fractions of the page width. Right-aligns columns listed in `right`. */
  table(head: string[], body: string[][], widths: number[], right: number[] = []) {
    const usable = A4[0] - 2 * MARGIN;
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i - 1] ?? MARGIN) + (i ? widths[i - 1] * usable : 0)], []).map((x, i) => (i === 0 ? MARGIN : x));
    const draw = (cells: string[], bold: boolean) => {
      this.ensure(14);
      cells.forEach((c, i) => {
        const font = bold ? this.bold : this.font;
        const maxW = widths[i] * usable - 6;
        let t = this.t(c);
        while (t.length > 1 && font.widthOfTextAtSize(t, 9) > maxW) t = t.slice(0, -2) + '.';
        const w = font.widthOfTextAtSize(t, 9);
        const x = right.includes(i) ? xs[i] + widths[i] * usable - w - 4 : xs[i];
        this.page.drawText(t, { x, y: this.y - 9, size: 9, font });
      });
      this.y -= 14;
    };
    draw(head, true);
    this.rule();
    for (const r of body) {
      if (this.y - 14 < MARGIN + 20) { this.newPage(); draw(head, true); this.rule(); }
      draw(r, false);
    }
  }

  async toBuffer(footer: string) {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => p.drawText(this.t(`${footer}   Page ${i + 1} of ${pages.length}`), { x: MARGIN, y: 25, size: 8, font: this.font, color: rgb(0.4, 0.4, 0.4) }));
    return Buffer.from(await this.doc.save());
  }
}
