import type { jsPDF } from 'jspdf';
import type { CourseDoc, Layout } from '@/course/doc';
import { snapshot, withLocalMedia } from './pageShot';
import { pageDetails, type Detail } from './walkthrough';
import './coursePdf.css';

const MARGIN = 12;
const HEADER = 10;
const SHEETS = {
  desktop: { orientation: 'portrait', w: 210, h: 297, shotW: 186 },
  phone: { orientation: 'portrait', w: 210, h: 297, shotW: 95 },
} as const;
const STAGE_RATIO: Record<Layout, number> = { desktop: 9 / 16, phone: 16 / 9 };
const MM_PER_PT = 0.3528;

class SheetWriter {
  private x = MARGIN;
  private y = MARGIN;
  private w = 0;
  private bottom = 0;

  constructor(
    private readonly pdf: jsPDF,
    private readonly sheet: (typeof SHEETS)[Layout],
    private readonly caption: string,
  ) {}

  startPage(number: number, title: string, first: boolean) {
    if (!first) this.pdf.addPage();
    this.header(`${number}. ${title}`);
  }

  region(x: number, y: number, w: number) {
    Object.assign(this, { x, y, w, bottom: this.sheet.h - MARGIN });
  }

  image(jpeg: string, x: number, y: number, w: number, h: number) {
    this.pdf.addImage(jpeg, 'JPEG', x, y, w, h);
    this.pdf.setDrawColor(200);
    this.pdf.rect(x, y, w, h);
  }

  details(list: Detail[], continued: string) {
    for (const d of list) {
      this.text(d.title, 9.5, true, 0, continued);
      for (const line of d.lines) {
        const indent = line.startsWith('   ') ? 4 : 0;
        this.text(line.trim(), 8.5, false, indent, continued);
      }
      this.y += 2;
    }
  }

  private header(left: string) {
    const { pdf, sheet } = this;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(this.caption, sheet.w - MARGIN, MARGIN + 4, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30);
    const room = sheet.w - 2 * MARGIN - pdf.getTextWidth(this.caption) - 6;
    pdf.text((pdf.splitTextToSize(left, room) as string[])[0], MARGIN, MARGIN + 4);
  }

  private text(value: string, size: number, bold: boolean, indent: number, continued: string) {
    const { pdf } = this;
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(bold ? 30 : 60);
    const lineH = size * MM_PER_PT * 1.35;
    for (const line of pdf.splitTextToSize(pdfText(value), this.w - indent) as string[]) {
      if (this.y + lineH > this.bottom) {
        pdf.addPage();
        this.header(continued);
        this.region(MARGIN, MARGIN + HEADER + 2, this.sheet.w - 2 * MARGIN);
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(bold ? 30 : 60);
      }
      this.y += lineH;
      pdf.text(line, this.x + indent, this.y);
    }
  }
}

const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const pdfText = (s: string) =>
  s
    .replace(/→/g, '->')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[✓✔]/g, 'v')
    .replace(/[^ -ÿ]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : '?'));

export async function coursePdf(
  doc: CourseDoc,
  layout: Layout,
  fetchMedia: (url: string) => Promise<Blob>,
  onStatus: (message: string) => void,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const sheet = SHEETS[layout];
  const pdf = new jsPDF({ orientation: sheet.orientation, unit: 'mm', format: 'a4' });
  const date = new Date().toLocaleDateString('en-AU', { dateStyle: 'medium' });
  const caption = `${doc.title}  |  ${layout === 'desktop' ? 'Desktop' : 'Phone'}  |  ${date}`;
  const writer = new SheetWriter(pdf, sheet, caption);
  const shotH = sheet.shotW * STAGE_RATIO[layout];
  const top = MARGIN + HEADER;

  await withLocalMedia(doc, fetchMedia, async (local) => {
    for (const [i, page] of local.pages.entries()) {
      onStatus(
        `${layout === 'desktop' ? 'Desktop' : 'Phone'}: page ${i + 1} of ${local.pages.length}`,
      );
      writer.startPage(i + 1, page.title, i === 0);
      writer.image(await snapshot(local, page, layout), MARGIN, top, sheet.shotW, shotH);
      if (layout === 'desktop') writer.region(MARGIN, top + shotH + 4, sheet.shotW);
      else writer.region(MARGIN + sheet.shotW + 8, top, sheet.w - 2 * MARGIN - sheet.shotW - 8);
      writer.details(pageDetails(doc, page), `${i + 1}. ${page.title} (continued)`);
    }
  });
  return pdf.output('blob');
}
