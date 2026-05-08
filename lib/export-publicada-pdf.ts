import jsPDF from 'jspdf';
import {
  type RGB, COLORS, MARGIN, CONTENT_W, PAGE_W,
  formatPhone, createPdfHelpers,
} from './pdf-helpers';

interface Lead {
  id: string;
  whatsapp_numero: string;
  nome_cliente: string | null;
  created_at: string;
}

interface ConteudoPagina {
  hero_titulo: string;
  hero_subtitulo: string;
  hero_media_url?: string;
  hero_media_type?: string;
  problema_titulo: string;
  problema_texto: string;
  problema_imagem_url?: string;
  solucao_titulo: string;
  solucao_texto: string;
  solucao_imagem_url?: string;
  modulos: { nome: string; descricao: string; horas: number; fase: string }[];
  stack: string[];
  cronograma: { fase: string; descricao: string; semanas: number; entregaveis: string[] }[];
  investimento_total: string;
  investimento_nota: string;
  investimento_imagem_url?: string;
  servicos: { nome: string; custo: string }[];
  riscos: string;
  cta_titulo: string;
  cta_texto: string;
  cta_imagem_url?: string;
  senha_acesso: string;
  validade_dias: number;
  resumo_executivo?: {
    saudacao: string;
    tipo_projeto: string;
    entendimento_do_cliente: string;
    entrega_em_uma_frase: string;
    numeros_chave: {
      investimento: { valor_total: string; forma_pagamento_resumida: string; valor_mensal_recorrente?: string | null };
      prazo: { duracao: string; data_estimada_entrega: string };
      escopo_resumido: { destaque_numerico: string; complemento: string };
    };
    o_que_voce_recebe: string[];
    o_que_nao_esta_incluso: string[];
    proximo_passo: { texto: string; tipo_acao: string; link_ou_contato: string };
    entrega_imagem_url?: string;
  };
  tema?: Record<string, string>;
}

export function exportPublicadaPDF(lead: Lead, cp: ConteudoPagina) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const h = createPdfHelpers(doc);

  const clientName = lead.nome_cliente || formatPhone(lead.whatsapp_numero);
  const re = cp.resumo_executivo;

  // ── Header ──
  h.drawHeader({
    subtitle: 'PROPOSTA PUBLICADA',
    title: cp.hero_titulo || clientName,
    metaParts: [cp.hero_subtitulo || ''],
  });

  // ── Resumo Executivo ──
  if (re) {
    h.checkPage(40);
    h.setY(h.drawSectionTitle('RESUMO EXECUTIVO', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    // Saudacao
    if (re.saudacao) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.goldLight);
      doc.text(re.saudacao, MARGIN + 2, h.getY());
      h.addY(6);
    }

    // Entendimento
    const entLines = h.wrapText(re.entendimento_do_cliente, CONTENT_W - 4, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    for (const line of entLines) {
      h.checkPage(5);
      doc.text(line, MARGIN + 2, h.getY());
      h.addY(4.5);
    }
    h.addY(3);

    // Entrega em uma frase
    if (re.entrega_em_uma_frase) {
      h.checkPage(10);
      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, 10, 2, [25, 20, 40]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.gold);
      doc.text(re.entrega_em_uma_frase, MARGIN + CONTENT_W / 2, h.getY() + 6.5, { align: 'center' });
      h.addY(14);
    }

    // KPI cards
    const kpis = [
      { label: 'INVESTIMENTO', value: re.numeros_chave.investimento.valor_total, sub: re.numeros_chave.investimento.forma_pagamento_resumida, color: COLORS.gold },
      { label: 'PRAZO', value: re.numeros_chave.prazo.duracao, sub: re.numeros_chave.prazo.data_estimada_entrega, color: COLORS.green },
      { label: 'ESCOPO', value: re.numeros_chave.escopo_resumido.destaque_numerico, sub: re.numeros_chave.escopo_resumido.complemento, color: COLORS.blue },
    ];

    const kpiW = (CONTENT_W - 10) / 3;
    const kpiH = 24;
    h.checkPage(kpiH + 4);

    for (let i = 0; i < kpis.length; i++) {
      const kx = MARGIN + i * (kpiW + 5);
      const ky = h.getY();
      h.drawRoundedRect(kx, ky, kpiW, kpiH, 2, COLORS.cardBg);
      doc.setFillColor(...kpis[i].color);
      doc.rect(kx + 2, ky, kpiW - 4, 0.6, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.textDim);
      doc.text(kpis[i].label, kx + kpiW / 2, ky + 7, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...kpis[i].color);
      doc.text(kpis[i].value, kx + kpiW / 2, ky + 14, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.textDim);
      const subLines = doc.splitTextToSize(kpis[i].sub, kpiW - 6) as string[];
      let sy = ky + 18;
      for (const sl of subLines) {
        doc.text(sl, kx + kpiW / 2, sy, { align: 'center' });
        sy += 3;
      }
    }
    h.setY(h.getY() + kpiH + 6);

    // O que voce recebe
    if (re.o_que_voce_recebe && re.o_que_voce_recebe.length > 0) {
      h.checkPage(15);
      h.setY(h.drawSectionTitle('O QUE VOCE RECEBE', h.getY()));
      h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
      h.addY(5);

      for (const item of re.o_que_voce_recebe) {
        const lines = h.wrapText(item, CONTENT_W - 12, 8.5);
        const cardH = 4 + lines.length * 4;
        h.checkPage(cardH);

        doc.setFillColor(...COLORS.green);
        doc.circle(MARGIN + 4, h.getY() + 2, 1.2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.text);
        let ly = h.getY() + 3;
        for (const line of lines) { doc.text(line, MARGIN + 8, ly); ly += 4; }
        h.addY(cardH + 1);
      }
      h.addY(4);
    }

    // O que nao esta incluso
    if (re.o_que_nao_esta_incluso && re.o_que_nao_esta_incluso.length > 0) {
      h.checkPage(15);
      h.setY(h.drawSectionTitle('O QUE NAO ESTA INCLUSO', h.getY()));
      h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
      h.addY(5);

      for (const item of re.o_que_nao_esta_incluso) {
        h.checkPage(6);
        doc.setFillColor(...COLORS.red);
        doc.circle(MARGIN + 4, h.getY() + 2, 1.2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.textDim);
        doc.text(item, MARGIN + 8, h.getY() + 3);
        h.addY(5);
      }
      h.addY(4);
    }
  }

  // ── Problema / Solucao ──
  if (cp.problema_texto || cp.solucao_texto) {
    h.checkPage(30);
    h.setY(h.drawSectionTitle('CONTEXTO', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    const halfW = (CONTENT_W - 6) / 2;

    // Problema card
    if (cp.problema_texto) {
      const pLines = h.wrapText(cp.problema_texto, halfW - 8, 8);
      const pH = 14 + pLines.length * 3.8;
      h.checkPage(pH);

      h.drawRoundedRect(MARGIN, h.getY(), halfW, pH, 2, COLORS.cardBg);
      doc.setFillColor(...COLORS.red);
      doc.rect(MARGIN + 2, h.getY(), halfW - 4, 0.6, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.red);
      doc.text((cp.problema_titulo || 'PROBLEMA').toUpperCase(), MARGIN + 5, h.getY() + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      let py = h.getY() + 13;
      for (const line of pLines) { doc.text(line, MARGIN + 5, py); py += 3.8; }

      // Solucao card (right)
      if (cp.solucao_texto) {
        const sLines = h.wrapText(cp.solucao_texto, halfW - 8, 8);
        const sH = 14 + sLines.length * 3.8;
        const cardH = Math.max(pH, sH);

        h.drawRoundedRect(MARGIN + halfW + 6, h.getY(), halfW, cardH, 2, COLORS.cardBg);
        doc.setFillColor(...COLORS.green);
        doc.rect(MARGIN + halfW + 8, h.getY(), halfW - 4, 0.6, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.green);
        doc.text((cp.solucao_titulo || 'SOLUCAO').toUpperCase(), MARGIN + halfW + 11, h.getY() + 8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.text);
        let sy = h.getY() + 13;
        for (const line of sLines) { doc.text(line, MARGIN + halfW + 11, sy); sy += 3.8; }

        h.setY(h.getY() + cardH + 4);
      } else {
        h.setY(h.getY() + pH + 4);
      }
    }
    h.addY(4);
  }

  // ── Modulos ──
  if (cp.modulos && cp.modulos.length > 0) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle(`ESCOPO (${cp.modulos.length} MODULOS)`, h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    // Group by phase
    const phases = new Map<string, typeof cp.modulos>();
    for (const m of cp.modulos) {
      const key = m.fase || 'geral';
      if (!phases.has(key)) phases.set(key, []);
      phases.get(key)!.push(m);
    }

    for (const [fase, mods] of phases) {
      h.checkPage(12);
      const faseLabel = fase.toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const flw = doc.getTextWidth(faseLabel) + 6;
      h.drawRoundedRect(MARGIN, h.getY(), flw, 5.5, 1.5, COLORS.purple);
      doc.setTextColor(255, 255, 255);
      doc.text(faseLabel, MARGIN + flw / 2, h.getY() + 3.8, { align: 'center' });
      h.addY(9);

      for (const m of mods) {
        const descLines = m.descricao ? (doc.setFontSize(7.5), doc.splitTextToSize(m.descricao, CONTENT_W - 20) as string[]) : [];
        const cardH = 12 + descLines.length * 3.5;
        h.checkPage(cardH);

        h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, cardH, 2, COLORS.cardBg);
        doc.setFillColor(...COLORS.blue);
        doc.rect(MARGIN, h.getY() + 2, 1.2, cardH - 4, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.goldLight);
        doc.text(m.nome, MARGIN + 6, h.getY() + 7);

        const hoursText = `${m.horas}h`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        const hw = doc.getTextWidth(hoursText) + 6;
        h.drawRoundedRect(MARGIN + CONTENT_W - hw - 4, h.getY() + 3, hw, 6, 1.5, [35, 30, 50]);
        doc.setTextColor(...COLORS.blue);
        doc.text(hoursText, MARGIN + CONTENT_W - hw / 2 - 4, h.getY() + 7.2, { align: 'center' });

        if (descLines.length > 0) {
          let my = h.getY() + 11;
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
  if (cp.cronograma && cp.cronograma.length > 0) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('CRONOGRAMA', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    for (let i = 0; i < cp.cronograma.length; i++) {
      const etapa = cp.cronograma[i];
      const descLines = (doc.setFontSize(8), doc.splitTextToSize(etapa.descricao, CONTENT_W - 30) as string[]);
      const entregaveis = etapa.entregaveis || [];
      const cardH = 14 + descLines.length * 3.8 + entregaveis.length * 3.5 + (entregaveis.length > 0 ? 4 : 0);

      h.checkPage(cardH);
      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, cardH, 2, COLORS.cardBg);

      // Step circle
      const cx = MARGIN + 8;
      const cy = h.getY() + 8;
      doc.setFillColor(...COLORS.gold);
      doc.circle(cx, cy, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.bg);
      doc.text(`${i + 1}`, cx, cy + 1.2, { align: 'center' });

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

      let ty = h.getY() + 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.text);
      for (const line of descLines) { doc.text(line, MARGIN + 16, ty); ty += 3.8; }

      if (entregaveis.length > 0) {
        ty += 1;
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.textDim);
        for (const e of entregaveis) {
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

  // ── Investimento + Servicos ──
  h.checkPage(25);
  h.setY(h.drawSectionTitle('INVESTIMENTO', h.getY()));
  h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
  h.addY(6);

  // Main investment card
  const invNoteLines = cp.investimento_nota ? h.wrapText(cp.investimento_nota, CONTENT_W - 12, 8) : [];
  const invH = 18 + invNoteLines.length * 3.5;
  h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, invH, 2, COLORS.cardBg);
  doc.setFillColor(...COLORS.gold);
  doc.rect(MARGIN + 2, h.getY(), CONTENT_W - 4, 0.6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.gold);
  doc.text(cp.investimento_total, MARGIN + CONTENT_W / 2, h.getY() + 12, { align: 'center' });

  if (invNoteLines.length > 0) {
    let ny = h.getY() + 17;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textDim);
    for (const line of invNoteLines) {
      doc.text(line, MARGIN + CONTENT_W / 2, ny, { align: 'center' });
      ny += 3.5;
    }
  }
  h.setY(h.getY() + invH + 4);

  // Servicos table
  if (cp.servicos && cp.servicos.length > 0) {
    h.checkPage(15);
    // Table header
    h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, 7, 1, [25, 20, 40]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textDim);
    doc.text('SERVICO MENSAL', MARGIN + 5, h.getY() + 4.5);
    doc.text('CUSTO', MARGIN + CONTENT_W - 5, h.getY() + 4.5, { align: 'right' });
    h.addY(9);

    for (const s of cp.servicos) {
      h.checkPage(8);
      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, 8, 1, COLORS.cardBg);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.goldLight);
      doc.text(s.nome, MARGIN + 5, h.getY() + 5.5);
      doc.setTextColor(...COLORS.green);
      doc.text(s.custo, MARGIN + CONTENT_W - 5, h.getY() + 5.5, { align: 'right' });
      h.addY(10);
    }
    h.addY(4);
  }

  // ── Stack ──
  if (cp.stack && cp.stack.length > 0) {
    h.checkPage(15);
    h.setY(h.drawSectionTitle('STACK TECNOLOGICA', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    const stackText = cp.stack.join('  |  ');
    const stackLines = h.wrapText(stackText, CONTENT_W - 8, 8.5);
    const stackH = 8 + stackLines.length * 4;
    h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, stackH, 2, COLORS.cardBg);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.purple);
    let sy = h.getY() + 6;
    for (const line of stackLines) { doc.text(line, MARGIN + 4, sy); sy += 4; }
    h.setY(h.getY() + stackH + 4);
  }

  // ── Riscos ──
  if (cp.riscos) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('RISCOS', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);
    h.drawInsightCard('PONTOS DE ATENCAO', cp.riscos, COLORS.yellow);
  }

  // ── CTA / Proximo passo ──
  if (cp.cta_titulo || (re && re.proximo_passo)) {
    h.checkPage(20);
    h.setY(h.drawSectionTitle('PROXIMO PASSO', h.getY()));
    h.drawLine(MARGIN, h.getY(), MARGIN + CONTENT_W, COLORS.gold, 0.2);
    h.addY(6);

    const ctaText = re?.proximo_passo?.texto || cp.cta_texto || '';
    if (ctaText) {
      const ctaLines = h.wrapText(ctaText, CONTENT_W - 12, 9);
      const ctaH = 10 + ctaLines.length * 4.5;
      h.drawRoundedRect(MARGIN, h.getY(), CONTENT_W, ctaH, 2, [25, 20, 40]);
      doc.setFillColor(...COLORS.green);
      doc.rect(MARGIN + 2, h.getY(), CONTENT_W - 4, 0.6, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      let cy = h.getY() + 7;
      for (const line of ctaLines) { doc.text(line, MARGIN + 6, cy); cy += 4.5; }
      h.addY(ctaH + 4);
    }
  }

  // ── Footer ──
  h.drawFooter('VVeronez.Dev - Proposta publicada');

  const fileName = `Proposta - ${clientName.replace(/[^a-zA-ZÀ-ú0-9 ]/g, '')}.pdf`;
  return { doc, fileName };
}
