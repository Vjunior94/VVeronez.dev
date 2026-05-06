import jsPDF from 'jspdf';

export type RGB = [number, number, number];

export const COLORS = {
  bg: [15, 12, 24] as RGB,
  cardBg: [22, 18, 34] as RGB,
  gold: [212, 160, 74] as RGB,
  goldLight: [235, 210, 160] as RGB,
  text: [220, 215, 230] as RGB,
  textDim: [140, 135, 155] as RGB,
  red: [232, 93, 117] as RGB,
  green: [95, 208, 184] as RGB,
  blue: [91, 168, 212] as RGB,
  purple: [184, 130, 201] as RGB,
  yellow: [212, 160, 74] as RGB,
  white: [255, 255, 255] as RGB,
};

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN = 18;
export const CONTENT_W = PAGE_W - MARGIN * 2;

export function formatPhone(num: string): string {
  const clean = num.replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const part1 = clean.slice(4, 9);
    const part2 = clean.slice(9, 13);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return num;
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Shared drawing helpers — instantiate once per PDF */
export function createPdfHelpers(doc: jsPDF) {
  let y = 0;

  function getY() { return y; }
  function setY(val: number) { y = val; }
  function addY(val: number) { y += val; }

  function checkPage(needed: number) {
    if (y + needed > PAGE_H - 15) {
      doc.addPage();
      drawPageBg();
      y = MARGIN;
    }
  }

  function drawPageBg() {
    doc.setFillColor(...COLORS.bg);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  }

  function drawRoundedRect(x: number, ry: number, w: number, h: number, r: number, fillColor: RGB) {
    doc.setFillColor(...fillColor);
    doc.roundedRect(x, ry, w, h, r, r, 'F');
  }

  function drawLine(x1: number, ly: number, x2: number, color: RGB, width = 0.3) {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, ly, x2, ly);
  }

  function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth) as string[];
  }

  function drawDiamond(dx: number, dy: number, size: number, color: RGB) {
    doc.setFillColor(...color);
    const s = size;
    doc.triangle(dx, dy - s, dx + s, dy, dx, dy + s, 'F');
    doc.triangle(dx, dy - s, dx - s, dy, dx, dy + s, 'F');
  }

  function drawSectionTitle(title: string, sy: number): number {
    drawDiamond(MARGIN + 3, sy - 1.5, 2.2, COLORS.gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gold);
    doc.text(title, MARGIN + 9, sy);
    return sy + 4;
  }

  function drawHeader(opts: {
    subtitle: string;
    title: string;
    metaParts: string[];
    badges?: { label: string; color: RGB }[];
  }) {
    drawPageBg();
    y = 0;
    drawRoundedRect(0, 0, PAGE_W, 52, 0, [18, 14, 30]);
    doc.setFillColor(...COLORS.gold);
    doc.rect(0, 52, PAGE_W, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gold);
    doc.text('VVERONEZ.DEV', MARGIN, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    doc.text(opts.subtitle, MARGIN, 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLORS.goldLight);
    doc.text(opts.title, MARGIN, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textDim);
    doc.text(opts.metaParts.join('  |  '), MARGIN, 46);

    // Right-side badges
    if (opts.badges) {
      let bx = PAGE_W - MARGIN;
      for (const badge of opts.badges) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const tw = doc.getTextWidth(badge.label) + 8;
        bx -= tw;
        drawRoundedRect(bx, 40, tw, 8, 2, badge.color);
        doc.setTextColor(255, 255, 255);
        doc.text(badge.label, bx + tw / 2, 45.5, { align: 'center' });
        bx -= 4;
      }
    }

    y = 60;
  }

  function drawFooter(footerText: string) {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFillColor(...COLORS.gold);
      doc.rect(0, PAGE_H - 8, PAGE_W, 0.4, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.textDim);
      doc.text(footerText, MARGIN, PAGE_H - 4);
      doc.text(`${p}/${pages}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' });
    }
  }

  /** Draw a text block section (title + paragraph) */
  function drawTextSection(title: string, text: string) {
    checkPage(30);
    y = drawSectionTitle(title, y);
    drawLine(MARGIN, y, MARGIN + CONTENT_W, COLORS.gold, 0.2);
    y += 5;

    const lines = wrapText(text, CONTENT_W - 4, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, MARGIN + 2, y);
      y += 4.5;
    }
    y += 6;
  }

  /** Draw an insight card (colored top bar + title + text) */
  function drawInsightCard(title: string, text: string, color: RGB) {
    const lines = wrapText(text, CONTENT_W - 12, 8.5);
    const cardH = 12 + lines.length * 4 + 4;
    checkPage(cardH);

    drawRoundedRect(MARGIN, y, CONTENT_W, cardH, 2, COLORS.cardBg);
    doc.setFillColor(...color);
    doc.rect(MARGIN + 2, y, CONTENT_W - 4, 0.6, 'F');

    let iy = y + 8;
    doc.setFillColor(...color);
    doc.circle(MARGIN + 8, iy - 1.2, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...color);
    doc.text(title, MARGIN + 12, iy);
    iy += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.text);
    for (const line of lines) {
      doc.text(line, MARGIN + 6, iy);
      iy += 4;
    }

    y += cardH + 3;
  }

  return {
    getY, setY, addY, checkPage,
    drawPageBg, drawRoundedRect, drawLine, wrapText,
    drawDiamond, drawSectionTitle, drawHeader, drawFooter,
    drawTextSection, drawInsightCard,
  };
}
