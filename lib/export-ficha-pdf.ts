import jsPDF from 'jspdf';
import {
  type RGB, COLORS, MARGIN, CONTENT_W,
  formatPhone, formatDate, createPdfHelpers,
} from './pdf-helpers';

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

const CAMPO_META: Record<string, { label: string; color: RGB }> = {
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

const FRASE_CAT: Record<string, { label: string; color: RGB }> = {
  dor:              { label: 'Dor',        color: COLORS.red },
  objetivo:         { label: 'Objetivo',   color: COLORS.green },
  frustracao:       { label: 'Frustração', color: COLORS.yellow },
  ambicao:          { label: 'Ambição',    color: COLORS.purple },
  contexto_negocio: { label: 'Contexto',   color: COLORS.blue },
  outro:            { label: 'Outro',      color: COLORS.textDim },
};

const TEMP_LABELS: Record<string, { label: string; color: RGB }> = {
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

export function exportFichaPDF(
  lead: Lead,
  fichaFields: FichaCampo[],
  frasesOuro: FraseOuro[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const h = createPdfHelpers(doc);

  const clientName = lead.nome_cliente || formatPhone(lead.whatsapp_numero);

  // Header
  const metaParts: string[] = [];
  if (lead.nome_cliente) metaParts.push(formatPhone(lead.whatsapp_numero));
  metaParts.push(`${lead.total_mensagens} mensagens`);
  metaParts.push(formatDate(lead.created_at));

  const badges: { label: string; color: RGB }[] = [];
  if (lead.temperatura && TEMP_LABELS[lead.temperatura]) {
    const t = TEMP_LABELS[lead.temperatura];
    badges.push({ label: t.label, color: t.color });
  }

  h.drawHeader({ subtitle: 'FICHA DO CLIENTE', title: clientName, metaParts, badges });

  // Resumo Executivo
  if (lead.resumo_executivo) {
    h.drawTextSection('RESUMO EXECUTIVO', lead.resumo_executivo);
  }

  // Ficha Fields (2-column grid)
  const fichaMap = new Map<string, FichaCampo>();
  fichaFields.forEach(f => fichaMap.set(f.campo, f));
  const fichaUnique = Array.from(fichaMap.values()).filter(f => f.campo !== 'nome_cliente');

  if (fichaUnique.length > 0) {
    h.checkPage(15);
    h.setY(h.drawSectionTitle('DADOS DO PROJETO', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    const colW = (CONTENT_W - 5) / 2;

    for (let i = 0; i < fichaUnique.length; i += 2) {
      const left = fichaUnique[i];
      const right = fichaUnique[i + 1];
      const leftH = calcCardHeight(doc, left, colW);
      const rightH = right ? calcCardHeight(doc, right, colW) : 0;
      const rowH = Math.max(leftH, rightH);

      h.checkPage(rowH + 4);
      drawFieldCard(doc, left, MARGIN, h.getY(), colW, rowH);
      if (right) drawFieldCard(doc, right, MARGIN + colW + 5, h.getY(), colW, rowH);
      h.addY(rowH + 4);
    }
    h.addY(4);
  }

  // Frases do Cliente
  if (frasesOuro.length > 0) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('FRASES DO CLIENTE', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    for (const f of frasesOuro) {
      const cat = FRASE_CAT[f.categoria] || FRASE_CAT.outro;
      const quoteLines = h.wrapText(`"${f.frase}"`, CONTENT_W - 14, 9);
      const importaLines = f.por_que_importa ? h.wrapText(f.por_que_importa, CONTENT_W - 14, 7.5) : [];
      const cardH = 10 + quoteLines.length * 4.5 + (importaLines.length > 0 ? importaLines.length * 3.5 + 2 : 0) + 4;

      h.checkPage(cardH);
      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, cardH, 2, COLORS.cardBg);
      doc.setFillColor(...cat.color);
      doc.rect(MARGIN, h.getY() + 2, 1.2, cardH - 4, 'F');

      let cy = h.getY() + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      const catLabel = cat.label.toUpperCase();
      const catW = doc.getTextWidth(catLabel) + 5;
      h.drawRoundedRect(MARGIN + 6, cy - 3, catW, 5, 1.5, cat.color);
      doc.setTextColor(255, 255, 255);
      doc.text(catLabel, MARGIN + 6 + catW / 2, cy, { align: 'center' });
      cy += 5;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      for (const line of quoteLines) { doc.text(line, MARGIN + 6, cy); cy += 4.5; }

      if (importaLines.length > 0) {
        cy += 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.textDim);
        for (const line of importaLines) { doc.text(line, MARGIN + 6, cy); cy += 3.5; }
      }
      h.addY(cardH + 3);
    }
    h.addY(4);
  }

  // Insights
  if (lead.alertas) h.drawInsightCard('ALERTAS', lead.alertas, COLORS.red);
  if (lead.justificativa_temperatura) h.drawInsightCard('JUSTIFICATIVA DA TEMPERATURA', lead.justificativa_temperatura, TEMP_LABELS[lead.temperatura || '']?.color || COLORS.gold);
  if (lead.tipo_solucao_sugerida) h.drawInsightCard('SOLUCAO SUGERIDA', lead.tipo_solucao_sugerida, COLORS.yellow);

  // Footer
  h.drawFooter('VVeronez.Dev - Ficha gerada automaticamente');

  const fileName = `Ficha - ${clientName.replace(/[^a-zA-ZÀ-ú0-9 ]/g, '')}.pdf`;
  return { doc, fileName };
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

  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(x, fy, w, h, 2, 2, 'F');

  doc.setFillColor(...color);
  doc.circle(x + 8, fy + 7, 3.5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(x + 8, fy + 7, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...color);
  doc.text(label.toUpperCase(), x + 14, fy + 8);

  const confColors: Record<string, RGB> = { alta: COLORS.green, media: COLORS.yellow, baixa: COLORS.red };
  const confLabel = field.confianca === 'alta' ? 'ALTA' : field.confianca === 'media' ? 'MEDIA' : 'BAIXA';
  const confColor = confColors[field.confianca] || COLORS.textDim;
  doc.setFontSize(5.5);
  const confW = doc.getTextWidth(confLabel) + 4;
  doc.setFillColor(...confColor);
  doc.roundedRect(x + w - confW - 4, fy + 4, confW, 4.5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(confLabel, x + w - confW / 2 - 4, fy + 7, { align: 'center' });

  let cy = fy + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.text);
  const valueLines = doc.splitTextToSize(field.valor_estruturado, w - 8) as string[];
  for (const line of valueLines) { doc.text(line, x + 4, cy); cy += 4; }

  if (field.frase_original) {
    cy += 2;
    doc.setFillColor(...color);
    doc.rect(x + 4, cy - 2.5, 0.6, 8, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textDim);
    const quoteLines = doc.splitTextToSize(`"${field.frase_original}"`, w - 12) as string[];
    for (const line of quoteLines) { doc.text(line, x + 7, cy); cy += 3.2; }
  }
}
