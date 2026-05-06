import jsPDF from 'jspdf';

interface Lead {
  id: string;
  whatsapp_numero: string;
  nome_cliente: string | null;
  status: string;
  temperatura: string | null;
  resumo_executivo: string | null;
  justificativa_temperatura: string | null;
  tipo_solucao_sugerida: string | null;
  alertas: string | null;
  proxima_acao_sugerida: string | null;
  total_mensagens: number;
  created_at: string;
  finalizado_em: string | null;
}

interface FichaCampo {
  id: string;
  campo: string;
  valor_estruturado: string;
  frase_original: string | null;
  confianca: string;
}

interface FraseOuro {
  id: string;
  frase: string;
  categoria: string;
  por_que_importa: string;
}

const COLORS = {
  bg: [15, 12, 24] as [number, number, number],
  cardBg: [22, 18, 34] as [number, number, number],
  gold: [212, 160, 74] as [number, number, number],
  goldLight: [235, 210, 160] as [number, number, number],
  text: [220, 215, 230] as [number, number, number],
  textDim: [140, 135, 155] as [number, number, number],
  red: [232, 93, 117] as [number, number, number],
  green: [95, 208, 184] as [number, number, number],
  blue: [91, 168, 212] as [number, number, number],
  purple: [184, 130, 201] as [number, number, number],
  yellow: [212, 160, 74] as [number, number, number],
};

const CAMPO_META: Record<string, { label: string; color: [number, number, number] }> = {
  tipo_projeto:       { label: 'Tipo de Projeto',     color: COLORS.purple },
  problema_objetivo:  { label: 'Problema / Objetivo', color: COLORS.red },
  estagio_atual:      { label: 'Estágio Atual',       color: COLORS.green },
  tamanho_escala:     { label: 'Tamanho / Escala',    color: COLORS.blue },
  prazo:              { label: 'Prazo',                color: COLORS.yellow },
  investimento:       { label: 'Investimento',         color: COLORS.green },
  decisao_contexto:   { label: 'Decisão / Contexto',  color: COLORS.purple },
  nome_cliente:       { label: 'Nome',                 color: COLORS.blue },
  observacoes_extras: { label: 'Observações',          color: COLORS.yellow },
};

const FRASE_CAT: Record<string, { label: string; color: [number, number, number] }> = {
  dor:              { label: 'Dor',        color: COLORS.red },
  objetivo:         { label: 'Objetivo',   color: COLORS.green },
  frustracao:       { label: 'Frustração', color: COLORS.yellow },
  ambicao:          { label: 'Ambição',    color: COLORS.purple },
  contexto_negocio: { label: 'Contexto',   color: COLORS.blue },
  outro:            { label: 'Outro',      color: COLORS.textDim },
};

const TEMP_LABELS: Record<string, { label: string; color: [number, number, number] }> = {
  quente: { label: 'QUENTE', color: COLORS.red },
  morno:  { label: 'MORNO',  color: COLORS.yellow },
  frio:   { label: 'FRIO',   color: COLORS.blue },
};

const ACAO_LABELS: Record<string, string> = {
  agendar_call_urgente: 'Call urgente',
  call_padrao: 'Agendar call',
  enviar_material_antes: 'Enviar material',
  discovery_pago_primeiro: 'Discovery pago',
  aguardar_retorno: 'Aguardar retorno',
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

function formatPhone(num: string): string {
  const clean = num.replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const part1 = clean.slice(4, 9);
    const part2 = clean.slice(9, 13);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return num;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function exportFichaPDF(
  lead: Lead,
  fichaFields: FichaCampo[],
  frasesOuro: FraseOuro[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;

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

  function drawRoundedRect(x: number, ry: number, w: number, h: number, r: number, fillColor: [number, number, number]) {
    doc.setFillColor(...fillColor);
    doc.roundedRect(x, ry, w, h, r, r, 'F');
  }

  function drawLine(x1: number, ly: number, x2: number, color: [number, number, number], width = 0.3) {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, ly, x2, ly);
  }

  // Wrap text and return lines
  function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth) as string[];
  }

  // Draw a small diamond shape as section icon (replaces Unicode chars)
  function drawDiamond(dx: number, dy: number, size: number, color: [number, number, number]) {
    doc.setFillColor(...color);
    // Draw diamond using a rotated square (triangle fan)
    const s = size;
    doc.triangle(dx, dy - s, dx + s, dy, dx, dy + s, 'F');
    doc.triangle(dx, dy - s, dx - s, dy, dx, dy + s, 'F');
  }

  // Draw section title with diamond icon
  function drawSectionTitle(title: string, sy: number): number {
    drawDiamond(MARGIN + 3, sy - 1.5, 2.2, COLORS.gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gold);
    doc.text(title, MARGIN + 9, sy);
    return sy + 4;
  }

  // ── Page 1 Background ──
  drawPageBg();

  // ── Header bar ──
  y = 0;
  drawRoundedRect(0, 0, PAGE_W, 52, 0, [18, 14, 30]);
  // Gold accent line
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 52, PAGE_W, 0.8, 'F');

  // Brand mark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gold);
  doc.text('VVERONEZ.DEV', MARGIN, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.textDim);
  doc.text('FICHA DO CLIENTE', MARGIN, 21);

  // Client name
  const clientName = lead.nome_cliente || formatPhone(lead.whatsapp_numero);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.goldLight);
  doc.text(clientName, MARGIN, 36);

  // Metadata row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textDim);
  const metaParts: string[] = [];
  if (lead.nome_cliente) metaParts.push(formatPhone(lead.whatsapp_numero));
  metaParts.push(`${lead.total_mensagens} mensagens`);
  metaParts.push(formatDate(lead.created_at));
  doc.text(metaParts.join('  |  '), MARGIN, 46);

  // Temperature + action badges (right side)
  let badgeX = PAGE_W - MARGIN;
  if (lead.temperatura && TEMP_LABELS[lead.temperatura]) {
    const t = TEMP_LABELS[lead.temperatura];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const tw = doc.getTextWidth(t.label) + 8;
    badgeX -= tw;
    drawRoundedRect(badgeX, 40, tw, 8, 2, [t.color[0], t.color[1], t.color[2]]);
    doc.setTextColor(255, 255, 255);
    doc.text(t.label, badgeX + tw / 2, 45.5, { align: 'center' });
    badgeX -= 4;
  }
  if (lead.proxima_acao_sugerida && ACAO_LABELS[lead.proxima_acao_sugerida]) {
    const label = ACAO_LABELS[lead.proxima_acao_sugerida];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const tw = doc.getTextWidth(label) + 8;
    badgeX -= tw;
    drawRoundedRect(badgeX, 40.5, tw, 7, 2, [35, 30, 50]);
    doc.setTextColor(...COLORS.goldLight);
    doc.text(label, badgeX + tw / 2, 45, { align: 'center' });
  }

  y = 60;

  // ── Resumo Executivo ──
  if (lead.resumo_executivo) {
    checkPage(30);
    y = drawSectionTitle('RESUMO EXECUTIVO', y);
    drawLine(MARGIN, y, MARGIN + CONTENT_W, COLORS.gold, 0.2);
    y += 5;

    const lines = wrapText(lead.resumo_executivo, CONTENT_W - 4, 9);
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

  // ── Ficha Fields (2-column grid) ──
  const fichaMap = new Map<string, FichaCampo>();
  fichaFields.forEach(f => fichaMap.set(f.campo, f));
  const fichaUnique = Array.from(fichaMap.values()).filter(f => f.campo !== 'nome_cliente');

  if (fichaUnique.length > 0) {
    checkPage(15);
    y = drawSectionTitle('DADOS DO PROJETO', y);
    drawLine(MARGIN, y, MARGIN + CONTENT_W, COLORS.gold, 0.2);
    y += 6;

    const colW = (CONTENT_W - 5) / 2;

    for (let i = 0; i < fichaUnique.length; i += 2) {
      const left = fichaUnique[i];
      const right = fichaUnique[i + 1];

      // Calculate heights
      const leftH = calcCardHeight(doc, left, colW);
      const rightH = right ? calcCardHeight(doc, right, colW) : 0;
      const rowH = Math.max(leftH, rightH);

      checkPage(rowH + 4);

      drawFieldCard(doc, left, MARGIN, y, colW, rowH);
      if (right) {
        drawFieldCard(doc, right, MARGIN + colW + 5, y, colW, rowH);
      }

      y += rowH + 4;
    }
    y += 4;
  }

  // ── Frases do Cliente ──
  if (frasesOuro.length > 0) {
    checkPage(20);
    y = drawSectionTitle('FRASES DO CLIENTE', y);
    drawLine(MARGIN, y, MARGIN + CONTENT_W, COLORS.gold, 0.2);
    y += 6;

    for (const f of frasesOuro) {
      const cat = FRASE_CAT[f.categoria] || FRASE_CAT.outro;
      const quoteLines = wrapText(`"${f.frase}"`, CONTENT_W - 14, 9);
      const importaLines = f.por_que_importa ? wrapText(f.por_que_importa, CONTENT_W - 14, 7.5) : [];
      const cardH = 10 + quoteLines.length * 4.5 + (importaLines.length > 0 ? importaLines.length * 3.5 + 2 : 0) + 4;

      checkPage(cardH);

      drawRoundedRect(MARGIN, y, CONTENT_W, cardH, 2, COLORS.cardBg);
      // Left accent bar
      doc.setFillColor(...cat.color);
      doc.rect(MARGIN, y + 2, 1.2, cardH - 4, 'F');

      // Category badge
      let cy = y + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...cat.color);
      const catLabel = cat.label.toUpperCase();
      const catW = doc.getTextWidth(catLabel) + 5;
      drawRoundedRect(MARGIN + 6, cy - 3, catW, 5, 1.5, [cat.color[0], cat.color[1], cat.color[2]]);
      doc.setTextColor(255, 255, 255);
      doc.text(catLabel, MARGIN + 6 + catW / 2, cy, { align: 'center' });
      cy += 5;

      // Quote
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      for (const line of quoteLines) {
        doc.text(line, MARGIN + 6, cy);
        cy += 4.5;
      }

      // Why it matters
      if (importaLines.length > 0) {
        cy += 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.textDim);
        for (const line of importaLines) {
          doc.text(line, MARGIN + 6, cy);
          cy += 3.5;
        }
      }

      y += cardH + 3;
    }
    y += 4;
  }

  // ── Insights Section ──
  const insights: { title: string; text: string; color: [number, number, number] }[] = [];
  if (lead.alertas) insights.push({ title: 'ALERTAS', text: lead.alertas, color: COLORS.red });
  if (lead.justificativa_temperatura) insights.push({ title: 'JUSTIFICATIVA DA TEMPERATURA', text: lead.justificativa_temperatura, color: TEMP_LABELS[lead.temperatura || '']?.color || COLORS.gold });
  if (lead.tipo_solucao_sugerida) insights.push({ title: 'SOLUCAO SUGERIDA', text: lead.tipo_solucao_sugerida, color: COLORS.yellow });

  if (insights.length > 0) {
    checkPage(15);
    y = drawSectionTitle('INSIGHTS DA SOFIA', y);
    drawLine(MARGIN, y, MARGIN + CONTENT_W, COLORS.gold, 0.2);
    y += 6;

    for (const insight of insights) {
      const lines = wrapText(insight.text, CONTENT_W - 12, 8.5);
      const cardH = 12 + lines.length * 4 + 4;
      checkPage(cardH);

      drawRoundedRect(MARGIN, y, CONTENT_W, cardH, 2, COLORS.cardBg);
      // Top colored line
      doc.setFillColor(...insight.color);
      doc.rect(MARGIN + 2, y, CONTENT_W - 4, 0.6, 'F');

      let iy = y + 8;
      // Small colored circle as icon
      doc.setFillColor(...insight.color);
      doc.circle(MARGIN + 8, iy - 1.2, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...insight.color);
      doc.text(insight.title, MARGIN + 12, iy);
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
  }

  // ── Footer ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...COLORS.gold);
    doc.rect(0, PAGE_H - 8, PAGE_W, 0.4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textDim);
    doc.text('VVeronez.Dev - Ficha gerada automaticamente', MARGIN, PAGE_H - 4);
    doc.text(`${p}/${pages}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' });
  }

  // Save
  const fileName = `Ficha - ${clientName.replace(/[^a-zA-ZÀ-ú0-9 ]/g, '')}.pdf`;
  doc.save(fileName);
}

function calcCardHeight(doc: jsPDF, field: FichaCampo, width: number): number {
  doc.setFontSize(8.5);
  const valueLines = doc.splitTextToSize(field.valor_estruturado, width - 8) as string[];
  let h = 14 + valueLines.length * 4;
  if (field.frase_original) {
    doc.setFontSize(7);
    const quoteLines = doc.splitTextToSize(`"${field.frase_original}"`, width - 12) as string[];
    h += 3 + quoteLines.length * 3.2;
  }
  return h + 4;
}

function drawFieldCard(doc: jsPDF, field: FichaCampo, x: number, fy: number, w: number, h: number) {
  const meta = CAMPO_META[field.campo];
  const color = meta?.color || COLORS.gold;
  const label = meta?.label || field.campo;

  // Card background
  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(x, fy, w, h, 2, 2, 'F');

  // Icon circle (solid colored dot)
  doc.setFillColor(color[0], color[1], color[2]);
  doc.circle(x + 8, fy + 7, 3.5, 'F');
  // Inner dot for visual depth
  doc.setFillColor(255, 255, 255);
  doc.circle(x + 8, fy + 7, 1.2, 'F');

  // Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...color);
  doc.text(label.toUpperCase(), x + 14, fy + 8);

  // Confidence badge
  const confColors: Record<string, [number, number, number]> = {
    alta: COLORS.green,
    media: COLORS.yellow,
    baixa: COLORS.red,
  };
  const confLabel = field.confianca === 'alta' ? 'ALTA' : field.confianca === 'media' ? 'MÉDIA' : 'BAIXA';
  const confColor = confColors[field.confianca] || COLORS.textDim;
  doc.setFontSize(5.5);
  const confW = doc.getTextWidth(confLabel) + 4;
  doc.setFillColor(confColor[0], confColor[1], confColor[2]);
  doc.roundedRect(x + w - confW - 4, fy + 4, confW, 4.5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(confLabel, x + w - confW / 2 - 4, fy + 7, { align: 'center' });

  // Value
  let cy = fy + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.text);
  const valueLines = doc.splitTextToSize(field.valor_estruturado, w - 8) as string[];
  for (const line of valueLines) {
    doc.text(line, x + 4, cy);
    cy += 4;
  }

  // Original quote
  if (field.frase_original) {
    cy += 2;
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x + 4, cy - 2.5, 0.6, 8, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    const quoteLines = doc.splitTextToSize(`"${field.frase_original}"`, w - 12) as string[];
    for (const line of quoteLines) {
      doc.text(line, x + 7, cy);
      cy += 3.2;
    }
  }
}
