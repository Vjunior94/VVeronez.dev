import jsPDF from 'jspdf';
import {
  type RGB, COLORS, MARGIN, CONTENT_W, PAGE_W,
  formatPhone, formatDate, formatBRL, createPdfHelpers,
} from './pdf-helpers';

interface Lead {
  id: string;
  whatsapp_numero: string;
  nome_cliente: string | null;
  created_at: string;
}

interface Proposta {
  id: string;
  status: string;
  resumo: string | null;
  stack_recomendada: Record<string, string> | null;
  cronograma: { fase: string; descricao: string; semanas: number; entregaveis: string[] }[] | null;
  total_horas: number;
  custo_dev_centavos: number;
  custo_fixo_centavos: number;
  custo_servicos_mensal_centavos: number;
  custo_total_centavos: number;
  valor_hora_centavos: number;
  riscos: string | null;
  observacoes: string | null;
}

interface Modulo {
  id: string;
  nome: string;
  descricao: string;
  complexidade: string;
  horas_estimadas: number;
  fase: string;
  ordem: number;
}

interface Servico {
  id: string;
  nome: string;
  descricao: string;
  custo_mensal_centavos: number;
  obrigatorio: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: RGB }> = {
  pronta:   { label: 'PRONTA',   color: COLORS.green },
  revisada: { label: 'REVISADA', color: COLORS.yellow },
  gerando:  { label: 'GERANDO',  color: COLORS.textDim },
};

const COMPLEXIDADE_COLORS: Record<string, RGB> = {
  baixa: COLORS.green,
  media: COLORS.yellow,
  alta: COLORS.red,
};

export function exportPropostaPDF(
  lead: Lead,
  proposta: Proposta,
  modulos: Modulo[],
  servicos: Servico[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const h = createPdfHelpers(doc);

  const clientName = lead.nome_cliente || formatPhone(lead.whatsapp_numero);

  // ── Header ──
  const metaParts: string[] = [];
  if (lead.nome_cliente) metaParts.push(formatPhone(lead.whatsapp_numero));
  metaParts.push(formatDate(lead.created_at));

  const badges: { label: string; color: RGB }[] = [];
  const st = STATUS_LABELS[proposta.status];
  if (st) badges.push({ label: st.label, color: st.color });

  h.drawHeader({ subtitle: 'PROPOSTA TECNICA', title: clientName, metaParts, badges });

  // ── KPI Cards (Custo + Horas + Valor/hora) ──
  h.checkPage(30);
  const kpiW = (CONTENT_W - 10) / 3;
  const kpiH = 22;
  const kpis = [
    { label: 'INVESTIMENTO TOTAL', value: formatBRL(proposta.custo_total_centavos), color: COLORS.gold },
    { label: 'TOTAL DE HORAS', value: `${proposta.total_horas}h`, color: COLORS.blue },
    { label: 'VALOR / HORA', value: formatBRL(proposta.valor_hora_centavos), color: COLORS.green },
  ];

  for (let i = 0; i < kpis.length; i++) {
    const kx = MARGIN + i * (kpiW + 5);
    const ky = h.getY();
    h.drawRoundedRect(kx, ky, kpiW, kpiH, 2, COLORS.cardBg);
    // Top accent
    doc.setFillColor(...kpis[i].color);
    doc.rect(kx + 2, ky, kpiW - 4, 0.6, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textDim);
    doc.text(kpis[i].label, kx + kpiW / 2, ky + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...kpis[i].color);
    doc.text(kpis[i].value, kx + kpiW / 2, ky + 17, { align: 'center' });
  }
  h.setY(h.getY() + kpiH + 8);

  // ── Cost breakdown (smaller cards) ──
  if (proposta.custo_dev_centavos || proposta.custo_fixo_centavos || proposta.custo_servicos_mensal_centavos) {
    const breakdowns = [
      { label: 'Desenvolvimento', value: formatBRL(proposta.custo_dev_centavos) },
      { label: 'Custos fixos', value: formatBRL(proposta.custo_fixo_centavos) },
      { label: 'Servicos/mes', value: formatBRL(proposta.custo_servicos_mensal_centavos) },
    ].filter(b => {
      const num = parseInt(b.value.replace(/\D/g, ''));
      return num > 0;
    });

    if (breakdowns.length > 0) {
      const bw = (CONTENT_W - (breakdowns.length - 1) * 5) / breakdowns.length;
      for (let i = 0; i < breakdowns.length; i++) {
        const bx = MARGIN + i * (bw + 5);
        const by = h.getY();
        h.drawRoundedRect(bx, by, bw, 14, 2, [18, 15, 28]);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...COLORS.textDim);
        doc.text(breakdowns[i].label, bx + 5, by + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.text);
        doc.text(breakdowns[i].value, bx + bw - 5, by + 10, { align: 'right' });
      }
      h.setY(h.getY() + 20);
    }
  }

  // ── Resumo ──
  if (proposta.resumo) {
    h.drawTextSection('RESUMO DA PROPOSTA', proposta.resumo.replace(/\*\*/g, ''));
  }

  // ── Modulos ──
  if (modulos.length > 0) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('MODULOS', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    // Group by phase
    const phases = new Map<string, Modulo[]>();
    for (const m of modulos) {
      const key = m.fase || 'geral';
      if (!phases.has(key)) phases.set(key, []);
      phases.get(key)!.push(m);
    }

    for (const [fase, mods] of phases) {
      h.checkPage(12);
      // Phase header
      const faseLabel = fase.toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.purple);
      const flw = doc.getTextWidth(faseLabel) + 6;
      h.drawRoundedRect(MARGIN, h.getY(), flw, 5.5, 1.5, [COLORS.purple[0], COLORS.purple[1], COLORS.purple[2]]);
      doc.setTextColor(255, 255, 255);
      doc.text(faseLabel, MARGIN + flw / 2, h.getY() + 3.8, { align: 'center' });
      h.addY(9);

      for (const m of mods) {
        const descLines = m.descricao ? (doc.setFontSize(7.5), doc.splitTextToSize(m.descricao, CONTENT_W - 20) as string[]) : [];
        const cardH = 12 + descLines.length * 3.5;
        h.checkPage(cardH);

        h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, cardH, 2, COLORS.cardBg);

        // Left accent based on complexity
        const compColor = COMPLEXIDADE_COLORS[m.complexidade] || COLORS.textDim;
        doc.setFillColor(...compColor);
        doc.rect(MARGIN, h.getY() + 2, 1.2, cardH - 4, 'F');

        // Module name
        let my = h.getY() + 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.goldLight);
        doc.text(m.nome, MARGIN + 6, my);

        // Hours badge (right)
        const hoursText = `${m.horas_estimadas}h`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        const hw = doc.getTextWidth(hoursText) + 6;
        h.drawRoundedRect(MARGIN + CONTENT_W - hw - 4, h.getY() + 3, hw, 6, 1.5, [35, 30, 50]);
        doc.setTextColor(...COLORS.blue);
        doc.text(hoursText, MARGIN + CONTENT_W - hw / 2 - 4, h.getY() + 7.2, { align: 'center' });

        // Complexity badge
        if (m.complexidade) {
          const cLabel = m.complexidade.toUpperCase();
          doc.setFontSize(5.5);
          const cw = doc.getTextWidth(cLabel) + 4;
          h.drawRoundedRect(MARGIN + CONTENT_W - hw - cw - 8, h.getY() + 3.5, cw, 5, 1, compColor);
          doc.setTextColor(255, 255, 255);
          doc.text(cLabel, MARGIN + CONTENT_W - hw - cw / 2 - 8, h.getY() + 6.8, { align: 'center' });
        }

        // Description
        if (descLines.length > 0) {
          my += 4;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...COLORS.textDim);
          for (const line of descLines) { doc.text(line, MARGIN + 6, my); my += 3.5; }
        }

        h.addY(cardH + 2);
      }
      h.addY(2);
    }
    h.addY(4);
  }

  // ── Cronograma ──
  if (proposta.cronograma && proposta.cronograma.length > 0) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('CRONOGRAMA', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    for (let i = 0; i < proposta.cronograma.length; i++) {
      const etapa = proposta.cronograma[i];
      const entregaLines = etapa.entregaveis || [];
      const descLines = (doc.setFontSize(8), doc.splitTextToSize(etapa.descricao, CONTENT_W - 30) as string[]);
      const cardH = 14 + descLines.length * 3.8 + entregaLines.length * 3.5 + (entregaLines.length > 0 ? 4 : 0);

      h.checkPage(cardH);
      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, cardH, 2, COLORS.cardBg);

      // Step number circle
      const cx = MARGIN + 8;
      const cy = h.getY() + 8;
      doc.setFillColor(...COLORS.gold);
      doc.circle(cx, cy, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.bg);
      doc.text(`${i + 1}`, cx, cy + 1.2, { align: 'center' });

      // Phase name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.goldLight);
      doc.text(etapa.fase, MARGIN + 16, h.getY() + 8);

      // Weeks badge
      const weeksText = `${etapa.semanas} sem.`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const ww = doc.getTextWidth(weeksText) + 6;
      h.drawRoundedRect(MARGIN + CONTENT_W - ww - 4, h.getY() + 4, ww, 6, 1.5, [35, 30, 50]);
      doc.setTextColor(...COLORS.green);
      doc.text(weeksText, MARGIN + CONTENT_W - ww / 2 - 4, h.getY() + 8.2, { align: 'center' });

      // Description
      let ty = h.getY() + 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      for (const line of descLines) { doc.text(line, MARGIN + 16, ty); ty += 3.8; }

      // Entregaveis
      if (entregaLines.length > 0) {
        ty += 1;
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.textDim);
        for (const e of entregaLines) {
          doc.setFillColor(...COLORS.green);
          doc.circle(MARGIN + 18, ty - 0.8, 0.8, 'F');
          doc.text(e, MARGIN + 21, ty);
          ty += 3.5;
        }
      }

      h.addY(cardH + 3);
    }
    h.addY(4);
  }

  // ── Stack Recomendada ──
  if (proposta.stack_recomendada && Object.keys(proposta.stack_recomendada).length > 0) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('STACK RECOMENDADA', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    const entries = Object.entries(proposta.stack_recomendada);
    const colW = (CONTENT_W - 5) / 2;

    for (let i = 0; i < entries.length; i += 2) {
      h.checkPage(14);
      for (let j = 0; j < 2 && i + j < entries.length; j++) {
        const [key, val] = entries[i + j];
        const sx = MARGIN + j * (colW + 5);
        h.drawRoundedRect(sx, h.getY(), colW, 12, 2, COLORS.cardBg);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.purple);
        doc.text(key.toUpperCase(), sx + 5, h.getY() + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        doc.text(val, sx + 5, h.getY() + 10);
      }
      h.addY(15);
    }
    h.addY(2);
  }

  // ── Servicos Externos ──
  if (servicos.length > 0) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('SERVICOS EXTERNOS (MENSAL)', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    // Table header
    h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, 7, 1, [25, 20, 40]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textDim);
    doc.text('SERVICO', MARGIN + 5, h.getY() + 4.5);
    doc.text('CUSTO/MES', MARGIN + CONTENT_W - 5, h.getY() + 4.5, { align: 'right' });
    h.addY(9);

    for (const s of servicos) {
      const descLines = s.descricao ? (doc.setFontSize(7), doc.splitTextToSize(s.descricao, CONTENT_W - 50) as string[]) : [];
      const rowH = 8 + descLines.length * 3.2;
      h.checkPage(rowH);

      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, rowH, 1, COLORS.cardBg);

      // Obrigatorio dot
      if (s.obrigatorio) {
        doc.setFillColor(...COLORS.red);
        doc.circle(MARGIN + 3, h.getY() + 5, 1, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.goldLight);
      doc.text(s.nome, MARGIN + 6, h.getY() + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.green);
      doc.text(formatBRL(s.custo_mensal_centavos) + '/mes', MARGIN + CONTENT_W - 5, h.getY() + 5, { align: 'right' });

      if (descLines.length > 0) {
        let dy = h.getY() + 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.textDim);
        for (const line of descLines) { doc.text(line, MARGIN + 6, dy); dy += 3.2; }
      }

      h.addY(rowH + 2);
    }

    // Total mensal
    const totalMensal = servicos.reduce((sum, s) => sum + s.custo_mensal_centavos, 0);
    if (totalMensal > 0) {
      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, 8, 1, [25, 20, 40]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.textDim);
      doc.text('TOTAL MENSAL', MARGIN + 5, h.getY() + 5.2);
      doc.setTextColor(...COLORS.gold);
      doc.text(formatBRL(totalMensal) + '/mes', MARGIN + CONTENT_W - 5, h.getY() + 5.2, { align: 'right' });
      h.addY(12);
    }
    h.addY(4);
  }

  // ── Observacoes ──
  if (proposta.observacoes) {
    h.drawTextSection('OBSERVACOES', proposta.observacoes.replace(/\*\*/g, ''));
  }

  // ── Riscos ──
  if (proposta.riscos) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('RISCOS', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);
    h.drawInsightCard('PONTOS DE ATENCAO', proposta.riscos.replace(/\*\*/g, ''), COLORS.yellow);
  }

  // ── Footer ──
  h.drawFooter('VVeronez.Dev - Proposta gerada automaticamente');

  const fileName = `Proposta - ${clientName.replace(/[^a-zA-ZÀ-ú0-9 ]/g, '')}.pdf`;
  return { doc, fileName };
}
