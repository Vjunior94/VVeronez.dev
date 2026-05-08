'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { DollarSign, Clock, LayoutGrid, Check, Minus, CheckCircle, ChevronLeft, ChevronRight, ArrowDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface Proposta {
  resumo: string | null;
  stack_recomendada: Record<string, string> | null;
  cronograma: { fase: string; descricao: string; semanas: number; entregaveis: string[] }[] | null;
  total_horas: number;
  custo_total_centavos: number;
  custo_servicos_mensal_centavos: number;
  riscos: string | null;
  observacoes: string | null;
}

interface Modulo { id: string; nome: string; descricao: string; horas_estimadas: number; fase: string; ordem: number; }
interface Servico { id: string; nome: string; descricao: string; custo_mensal_centavos: number; }

interface Tema {
  cor_primaria?: string;
  cor_fundo?: string;
  cor_fundo_card?: string;
  cor_texto?: string;
  cor_accent?: string;
  cor_muted?: string;
  fonte_titulo?: string;
  fonte_corpo?: string;
  border_radius?: string;
}

interface ResumoExecutivo {
  saudacao: string;
  tipo_projeto: string;
  entendimento_do_cliente: string;
  entrega_em_uma_frase: string;
  numeros_chave: {
    investimento: { valor_total: string; forma_pagamento_resumida: string; valor_mensal_recorrente: string | null };
    prazo: { duracao: string; data_estimada_entrega: string };
    escopo_resumido: { destaque_numerico: string; complemento: string };
  };
  o_que_voce_recebe: string[];
  o_que_nao_esta_incluso: string[];
  proximo_passo: { texto: string; tipo_acao: 'whatsapp' | 'aceite_link' | 'email'; link_ou_contato: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderMd(text: string) {
  const expanded = text.replace(/(?:^|\s)(\d+)\)\s/g, '\n$1) ').trim();
  return expanded.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    );
    const isList = line.trimStart().startsWith('- ');
    const numberedMatch = line.trimStart().match(/^(\d+)\)\s/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const content = rendered.map((r) => typeof r === 'string' ? r.replace(/^\d+\)\s*/, '') : r);
      return (
        <div key={i} style={{
          display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', padding: '1rem 1.2rem',
          background: 'rgba(255,255,255,0.025)', borderRadius: '10px',
          borderLeft: '3px solid var(--bronze)',
        }}>
          <span style={{ color: 'var(--bronze2)', fontFamily: "'Cinzel',Georgia,serif", fontWeight: 700, fontSize: '1.1em', flexShrink: 0, lineHeight: 1.6 }}>{num}.</span>
          <span style={{ lineHeight: 1.7 }}>{content}</span>
        </div>
      );
    }
    if (isList) {
      return (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ color: 'var(--bronze)', flexShrink: 0 }}>◆</span>
          <span>{rendered.map((r) => typeof r === 'string' ? r.replace(/^-\s*/, '') : r)}</span>
        </div>
      );
    }
    return line.trim() ? <p key={i} style={{ marginBottom: '0.4rem' }}>{rendered}</p> : <br key={i} />;
  });
}

function getModuleIcon(nome: string) {
  const n = nome.toLowerCase();
  if (n.includes('auth') || n.includes('login') || n.includes('acesso')) return '🔐';
  if (n.includes('dashboard') || n.includes('painel')) return '📊';
  if (n.includes('pwa') || n.includes('mobile') || n.includes('app')) return '📱';
  if (n.includes('pagamento') || n.includes('payment') || n.includes('checkout')) return '💳';
  if (n.includes('chat') || n.includes('mensag') || n.includes('notif')) return '💬';
  if (n.includes('ia') || n.includes('intelig') || n.includes('ai') || n.includes('claude')) return '🧠';
  if (n.includes('api') || n.includes('integra')) return '🔗';
  if (n.includes('setup') || n.includes('deploy') || n.includes('infra')) return '🚀';
  if (n.includes('catálogo') || n.includes('produto') || n.includes('loja')) return '🛍️';
  if (n.includes('upload') || n.includes('mídia') || n.includes('vídeo') || n.includes('aula')) return '🎬';
  if (n.includes('financeiro') || n.includes('fatur') || n.includes('dre')) return '💰';
  if (n.includes('relatório') || n.includes('report') || n.includes('métricas')) return '📈';
  if (n.includes('agenda') || n.includes('calendar') || n.includes('cronograma')) return '📅';
  if (n.includes('email') || n.includes('smtp')) return '📧';
  if (n.includes('admin') || n.includes('gestão') || n.includes('gerenc')) return '⚙️';
  return '◆';
}

// ─── Page ────────────────────────────────────────────────────────────

export default function PropostaPublicaPage() {
  const params = useParams();
  const id = params.id as string;
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [cliente, setCliente] = useState('');
  const [conteudo, setConteudo] = useState<any>(null);
  const [respostas, setRespostas] = useState<any[]>([]);
  const [respNome, setRespNome] = useState('');
  const [respEmail, setRespEmail] = useState('');
  const [respMotivo, setRespMotivo] = useState('');
  const [respLoading, setRespLoading] = useState(false);
  const [respErro, setRespErro] = useState('');
  const [respSucesso, setRespSucesso] = useState<string | null>(null);
  const [respTab, setRespTab] = useState<'aceitar' | 'recusar' | 'consideracoes'>('aceitar');
  const [viewMode, setViewMode] = useState<'slides' | 'details'>('slides');
  const [currentSlide, setCurrentSlide] = useState(0);
  const slidesRef = useRef<HTMLDivElement>(null);

  const goToSlide = useCallback((index: number) => {
    if (!slidesRef.current) return;
    const slides = slidesRef.current.children;
    if (index < 0 || index >= slides.length) return;
    slides[index].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setCurrentSlide(index);
  }, []);

  useEffect(() => {
    if (viewMode !== 'slides' || !slidesRef.current) return;
    const container = slidesRef.current;
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const slideWidth = container.clientWidth;
      const index = Math.round(scrollLeft / slideWidth);
      setCurrentSlide(index);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'slides') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToSlide(currentSlide + 1);
      if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewMode, currentSlide, goToSlide]);

  const handleUnlock = async () => {
    if (!id || !senha.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/proposta/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: senha.trim() }),
      });
      if (res.status === 401) { setError('Senha incorreta. Tente novamente.'); setLoading(false); return; }
      if (!res.ok) { setError('Proposta não encontrada.'); setLoading(false); return; }
      const data = await res.json();
      setProposta(data.proposta); setModulos(data.modulos); setServicos(data.servicos);
      setCliente(data.cliente);
      if (data.respostas) setRespostas(data.respostas);
      if (data.proposta.conteudo_pagina) setConteudo(data.proposta.conteudo_pagina);
      setUnlocked(true);
    } catch { setError('Erro ao acessar.'); } finally { setLoading(false); }
  };

  const respostaDefinitiva = respostas.find((r: any) => r.status === 'aceito' || r.status === 'recusado');

  const handleResposta = async (status: 'aceito' | 'recusado' | 'consideracoes') => {
    if (!respNome.trim() || !respEmail.trim()) return;
    if (status === 'recusado' && !respMotivo.trim()) return;
    if (status === 'consideracoes' && !respMotivo.trim()) return;
    setRespLoading(true); setRespErro('');
    try {
      const res = await fetch(`/api/proposta/${id}/aceitar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: respNome.trim(), email: respEmail.trim(), status, motivo: respMotivo.trim() || null }),
      });
      if (res.status === 409) { setRespSucesso(status); setRespLoading(false); return; }
      if (!res.ok) { setRespErro('Erro ao enviar. Tente novamente.'); setRespLoading(false); return; }
      setRespSucesso(status);
      setRespostas(prev => [...prev, { nome: respNome.trim(), email: respEmail.trim(), status, motivo: respMotivo.trim(), aceito_em: new Date().toISOString() }]);
    } catch { setRespErro('Erro de conexão.'); } finally { setRespLoading(false); }
  };

  const c = conteudo;
  const re = c?.resumo_executivo as ResumoExecutivo | undefined;
  const tema = (c?.tema || {}) as Tema;

  // Generate CSS variable overrides from tema
  const temaCSS = [
    tema.cor_primaria && `--bronze: ${tema.cor_primaria}; --bronze2: ${tema.cor_accent || tema.cor_primaria};`,
    tema.cor_fundo && `--bg: ${tema.cor_fundo};`,
    tema.cor_fundo_card && `--bg2: ${tema.cor_fundo_card};`,
    tema.cor_texto && `--text: ${tema.cor_texto};`,
    tema.cor_accent && `--bronze2: ${tema.cor_accent};`,
    tema.cor_muted && `--muted: ${tema.cor_muted};`,
    tema.fonte_titulo && `--font-titulo: ${tema.fonte_titulo}, 'Cinzel', Georgia, serif;`,
    tema.fonte_corpo && `--font-corpo: ${tema.fonte_corpo}, system-ui, sans-serif;`,
    tema.border_radius && `--radius: ${tema.border_radius};`,
  ].filter(Boolean).join(' ');
  const temaOverride = temaCSS ? `:root { ${temaCSS} }` +
    (tema.fonte_titulo ? `.hero-title, .section-title, .cta-title, .re-name, .re-oneliner-text, .re-card-value, .re-list-title, .invest-price, .summary-num, .hero-meta-value, .context-card-title { font-family: var(--font-titulo) !important; }` : '') +
    (tema.fonte_corpo ? `.prop-page, .hero-sub, .re-understand-text, .re-action-text, .re-list-item, .context-text, .module-desc, .tl-desc, .invest-row-label, .invest-note, .risk-card, .cta-sub { font-family: var(--font-corpo) !important; }` : '') +
    (tema.border_radius ? `.context-card, .modules-grid, .invest-card, .risk-card, .re-card, .re-understand, .re-list-item--check, .re-action-btn, .modules-summary, .stack-card, .invest-breakdown, .invest-note, .invest-seal, .re-card-pill { border-radius: var(--radius) !important; }` : '')
    : '';
  const displayModulos = c?.modulos || modulos.map((m: Modulo) => ({ nome: m.nome, descricao: m.descricao, horas: m.horas_estimadas, fase: m.fase }));
  const fases = ['mvp', 'v1', 'v2'];
  const modulosByFase = fases.map(f => ({ fase: f, mods: displayModulos.filter((m: any) => m.fase === f) })).filter((g: any) => g.mods.length > 0);

  // ─── Lock Screen ───────────────────────────────────────────────────

  if (!unlocked) {
    return (
      <>
        <style>{pageCSS}</style>
        <div className="lock-screen">
          <div className="lock-card">
            <a href="/" className="lock-logo" style={{ textDecoration: 'none' }}>VV<span>eronez</span>.dev</a>
            <div className="lock-label">Acesso exclusivo</div>
            <div className="lock-title">Acesse sua proposta</div>
            <input type="password" className={`lock-input ${error ? 'lock-input-error' : ''}`} placeholder="Digite a senha" value={senha}
              onChange={e => { setSenha(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleUnlock()} autoFocus />
            {error && <div className="lock-error-msg">{error}</div>}
            <button className="lock-btn" onClick={handleUnlock} disabled={loading}>{loading ? 'Acessando...' : 'Acessar proposta →'}</button>
            <div className="lock-footer">Esta proposta é confidencial e preparada exclusivamente para você.<br />Em caso de dúvidas, entre em contato pelo WhatsApp.</div>
          </div>
        </div>
      </>
    );
  }

  // ─── Derived data ──────────────────────────────────────────────────

  const p = proposta!;
  const displayCrono = c?.cronograma || p.cronograma || [];
  const totalSemanas = displayCrono.reduce((acc: number, f: any) => acc + f.semanas, 0);
  const heroTitle = c?.hero_titulo || `Proposta para\n${cliente}`;
  const heroSub = c?.hero_subtitulo || p.resumo || '';
  const heroMedia = c?.hero_media_url || (p as any).hero_media_url || '';
  const heroMediaType = c?.hero_media_type || 'image';
  const displayStack = c?.stack || (p.stack_recomendada ? Object.values(p.stack_recomendada).filter(Boolean) : []);
  const investTotal = c?.investimento_total || formatBRL(p.custo_total_centavos);
  const investNota = c?.investimento_nota || p.observacoes || '';
  const displayRiscos = c?.riscos || p.riscos || '';
  const ctaTitulo = c?.cta_titulo || 'Pronto para\ncomeçar?';
  const ctaTexto = c?.cta_texto || 'Vamos marcar uma conversa para alinhar os detalhes e dar o primeiro passo.';
  const displayServicos = c?.servicos || servicos.map((s: Servico) => ({ nome: s.nome, custo: formatBRL(s.custo_mensal_centavos) + '/mês' }));
  const totalHoras = displayModulos.reduce((a: number, m: any) => a + (m.horas || m.horas_estimadas || 0), 0);
  const maxModHoras = Math.max(...displayModulos.map((m: any) => m.horas || m.horas_estimadas || 0), 1);

  // ─── Hero component ─────────────────────────────────────────────────

  const heroSection = (
    <div className="prop-hero">
      <div className="hero-glow" />
      <div className="hero-glow-2" />
      <div className="prop-hero-inner" style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-line" />
            <div className="hero-eyebrow-text">Proposta técnica · {new Date().getFullYear()}</div>
          </div>
          <h1 className="hero-title">
            {heroTitle.split('\n').map((line: string, i: number) => (
              <span key={i}>{i === heroTitle.split('\n').length - 1 ? <em>{line}</em> : <>{line}<br /></>}</span>
            ))}
          </h1>
          {heroSub && <div className="hero-sub">{renderMd(heroSub)}</div>}
          <div className="hero-meta">
            <div className="hero-meta-item">
              <div className="hero-meta-label">Prazo estimado</div>
              <div className="hero-meta-value">{totalSemanas} semanas</div>
            </div>
            <div className="hero-meta-item">
              <div className="hero-meta-label">Módulos</div>
              <div className="hero-meta-value">{displayModulos.length}</div>
            </div>
            {c?.validade_dias && (
              <div className="hero-meta-item">
                <div className="hero-meta-label">Validade da proposta</div>
                <div className="hero-meta-value">{c.validade_dias} dias</div>
              </div>
            )}
          </div>
        </div>
        {heroMedia && (
          <div className="hero-media">
            {heroMediaType === 'video' ? (
              <video src={heroMedia} autoPlay muted loop playsInline style={{ width: '100%', height: 'auto', display: 'block' }} />
            ) : (
              <img src={heroMedia} alt="Preview" style={{ width: '100%', height: 'auto', display: 'block' }} />
            )}
          </div>
        )}
      </div>
      <div className="scroll-hint">
        <div className="scroll-line" />
        <span>scroll</span>
      </div>
    </div>
  );

  // ─── Details sections (without hero) ───────────────────────────────

  const detailsSections = (
    <>
      {/* Contexto */}
      {c?.problema_texto && (
        <section className="prop-section anim-section">
          <div className="section-tag">01 — Contexto</div>
          <h2 className="section-title">O problema que<br />vamos resolver</h2>
          <p className="section-subtitle">Entendemos sua situação atual e propomos uma solução sob medida.</p>
          <div className="context-grid">
            <div className="context-card context-problem">
              {c.problema_imagem_url && <img src={c.problema_imagem_url} alt="" className="context-img" />}
              <div className="context-icon">⚠</div>
              <div className="context-label problem-label">O cenário atual</div>
              <div className="context-card-title">{c.problema_titulo}</div>
              <div className="context-text">{c.problema_texto}</div>
            </div>
            <div className="context-connector">
              <svg viewBox="0 0 60 20"><path d="M0 10 H45 M40 4 L48 10 L40 16" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </div>
            <div className="context-card context-solution">
              {c.solucao_imagem_url && <img src={c.solucao_imagem_url} alt="" className="context-img" />}
              <div className="context-icon">◆</div>
              <div className="context-label solution-label">A transformação</div>
              <div className="context-card-title">{c.solucao_titulo}</div>
              <div className="context-text">{c.solucao_texto}</div>
            </div>
          </div>
        </section>
      )}

      {/* Módulos */}
      <section className="prop-section anim-section">
        <div className="section-tag">{c?.problema_texto ? '02' : '01'} — Escopo</div>
        <h2 className="section-title">O que será<br />construído</h2>
        <p className="section-subtitle">Cada módulo é uma funcionalidade do seu sistema. Juntos, formam a solução completa.</p>
        <div className="modules-grid">
          {displayModulos.map((m: any, i: number) => (
            <div key={i} className="module-card">
              <div className="module-header">
                <span className="module-icon">{getModuleIcon(m.nome)}</span>
                <span className="module-num">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="module-name">{m.nome}</div>
              <div className="module-desc">{m.descricao}</div>
              <div className="module-footer">
                <div className="module-bar-wrap">
                  <div className="module-bar" style={{ width: `${((m.horas || m.horas_estimadas) / maxModHoras) * 100}%` }} />
                </div>
                <div className="module-meta">
                  <span>{m.horas || m.horas_estimadas}h</span>
                  <span className="module-fase-badge" data-fase={m.fase}>{m.fase.toUpperCase()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="modules-summary">
          <div className="summary-item"><span className="summary-num">{displayModulos.length}</span><span className="summary-label">módulos</span></div>
          <div className="summary-divider" />
          <div className="summary-item"><span className="summary-num">{totalHoras}h</span><span className="summary-label">de desenvolvimento</span></div>
          <div className="summary-divider" />
          <div className="summary-item"><span className="summary-num">{modulosByFase.length}</span><span className="summary-label">fases</span></div>
        </div>
      </section>

      {/* Stack */}
      {displayStack.length > 0 && (
        <section className="prop-section anim-section">
          <div className="section-tag">{c?.problema_texto ? '03' : '02'} — Tecnologia</div>
          <h2 className="section-title">Tecnologias<br />utilizadas</h2>
          <p className="section-subtitle">Ferramentas modernas, testadas em produção nas maiores empresas do mundo.</p>
          <div className="stack-grid">
            {displayStack.map((val: string, i: number) => (
              <div key={i} className="stack-card"><div className="stack-card-name">{val}</div></div>
            ))}
          </div>
        </section>
      )}

      {/* Cronograma */}
      {displayCrono.length > 0 && (
        <section className="prop-section anim-section">
          <div className="section-tag">{c?.problema_texto ? '04' : '03'} — Cronograma</div>
          <h2 className="section-title">Etapas do<br />projeto</h2>
          <p className="section-subtitle">O desenvolvimento acontece em fases. Cada uma entrega valor funcional.</p>
          <div className="timeline">
            {displayCrono.map((fase: any, i: number) => (
              <div key={i} className="tl-item">
                <div className="tl-marker"><div className="tl-dot" />{i < displayCrono.length - 1 && <div className="tl-line" />}</div>
                <div className="tl-content">
                  <div className="tl-phase">Fase {String(i + 1).padStart(2, '0')}</div>
                  <div className="tl-name">{fase.fase || fase.descricao}</div>
                  <div className="tl-desc">{fase.descricao}</div>
                  <div className="tl-footer">
                    <span className="tl-weeks">{fase.semanas} semana{fase.semanas > 1 ? 's' : ''}</span>
                    {fase.entregaveis?.length > 0 && (
                      <div className="tl-deliverables">
                        {fase.entregaveis.map((e: string, j: number) => <span key={j} className="tl-tag">{e}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Investimento */}
      <section className="prop-section anim-section">
        <div className="section-tag">Investimento</div>
        <h2 className="section-title">Proposta<br />financeira</h2>
        <p className="section-subtitle">Transparência total. Você sabe exatamente o que está pagando e por quê.</p>
        <div className="invest-card">
          <div className="invest-glow" />
          <div className="invest-price">{investTotal}</div>
          <div className="invest-label">Valor total do desenvolvimento</div>
          <div className="invest-breakdown">
            <div className="invest-row"><span className="invest-row-label">Horas de desenvolvimento</span><span className="invest-row-value">{p.total_horas}h × R$ 50,00</span></div>
            <div className="invest-row"><span className="invest-row-label">Setup + deploy + infra</span><span className="invest-row-value">R$ 1.000,00</span></div>
            {displayServicos.map((s: any, i: number) => (
              <div key={i} className="invest-row"><span className="invest-row-label">{s.nome} (mensal)</span><span className="invest-row-value">{s.custo}</span></div>
            ))}
          </div>
          {investNota && <div className="invest-note">{renderMd(investNota)}</div>}
          <div className="invest-seal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <div><strong>Garantia de entrega</strong><br /><span>Código-fonte 100% seu. Deploy incluído.</span></div>
          </div>
        </div>
      </section>

      {/* Riscos */}
      {displayRiscos && (
        <section className="prop-section anim-section">
          <div className="section-tag">Considerações</div>
          <h2 className="section-title">Pontos de<br />atenção</h2>
          <div className="risk-card">{renderMd(displayRiscos)}</div>
        </section>
      )}

      {/* Resposta do cliente */}
      <section className="prop-section anim-section" id="aceite-proposta">
        <div className="section-tag">Sua resposta</div>
        <h2 className="section-title">O que você<br />achou?</h2>

        {respostaDefinitiva || respSucesso ? (
          <div className="aceite-success" style={{
            borderColor: (respostaDefinitiva?.status || respSucesso) === 'aceito' ? 'rgba(95,208,184,0.15)' :
              (respostaDefinitiva?.status || respSucesso) === 'recusado' ? 'rgba(192,80,74,0.15)' : 'rgba(200,130,107,0.15)',
            background: (respostaDefinitiva?.status || respSucesso) === 'aceito' ? 'rgba(95,208,184,0.04)' :
              (respostaDefinitiva?.status || respSucesso) === 'recusado' ? 'rgba(192,80,74,0.04)' : 'rgba(200,130,107,0.04)',
          }}>
            <CheckCircle size={48} style={{
              color: (respostaDefinitiva?.status || respSucesso) === 'aceito' ? 'var(--teal)' :
                (respostaDefinitiva?.status || respSucesso) === 'recusado' ? '#c0504a' : 'var(--bronze)',
              marginBottom: '1rem',
            }} />
            <div className="aceite-success-title" style={{
              color: (respostaDefinitiva?.status || respSucesso) === 'aceito' ? 'var(--teal)' :
                (respostaDefinitiva?.status || respSucesso) === 'recusado' ? '#c0504a' : 'var(--bronze)',
            }}>
              {(respostaDefinitiva?.status || respSucesso) === 'aceito' && 'Proposta aceita!'}
              {(respostaDefinitiva?.status || respSucesso) === 'recusado' && 'Proposta recusada'}
              {(respostaDefinitiva?.status || respSucesso) === 'consideracoes' && 'Considerações enviadas!'}
            </div>
            <div className="aceite-success-info">
              {respostaDefinitiva?.nome && <span>Por {respostaDefinitiva.nome}</span>}
              {respostaDefinitiva?.aceito_em && <span> em {new Date(respostaDefinitiva.aceito_em).toLocaleDateString('pt-BR')}</span>}
            </div>
            <p className="aceite-success-text">
              {(respostaDefinitiva?.status || respSucesso) === 'aceito' && 'Valmir entrará em contato para alinhar os detalhes e preparar o contrato, que será revisado por ambas as partes antes de qualquer compromisso.'}
              {(respostaDefinitiva?.status || respSucesso) === 'recusado' && 'Agradecemos seu retorno. Valmir pode entrar em contato para entender melhor e, se fizer sentido, ajustar a proposta.'}
              {(respostaDefinitiva?.status || respSucesso) === 'consideracoes' && 'Suas considerações foram recebidas. Valmir analisará seus pontos e entrará em contato em breve.'}
            </p>
          </div>
        ) : (
          <div className="aceite-form-wrap">
            {/* Tabs */}
            <div className="resp-tabs">
              <button className={`resp-tab${respTab === 'aceitar' ? ' resp-tab--active resp-tab--aceitar' : ''}`} onClick={() => setRespTab('aceitar')}>Aceitar</button>
              <button className={`resp-tab${respTab === 'consideracoes' ? ' resp-tab--active resp-tab--consideracoes' : ''}`} onClick={() => setRespTab('consideracoes')}>Considerações</button>
              <button className={`resp-tab${respTab === 'recusar' ? ' resp-tab--active resp-tab--recusar' : ''}`} onClick={() => setRespTab('recusar')}>Recusar</button>
            </div>

            {/* Descrição do que cada ação significa */}
            <div className="resp-desc">
              {respTab === 'aceitar' && (
                <p>Aceitar a proposta <strong>não é um fechamento de negócio</strong>. Significa que você está de acordo com o escopo e valores apresentados. O próximo passo será alinhar os detalhes e gerar um contrato formal, que será revisado e aprovado por ambas as partes.</p>
              )}
              {respTab === 'consideracoes' && (
                <p>Tem dúvidas, sugestões ou pontos que gostaria de discutir antes de tomar uma decisão? Envie suas considerações abaixo. A proposta continuará disponível para aceite ou recusa depois.</p>
              )}
              {respTab === 'recusar' && (
                <p>Se a proposta não atende suas expectativas, informe o motivo abaixo. Seu feedback é importante para entendermos melhor suas necessidades.</p>
              )}
            </div>

            <div className="aceite-form">
              <input type="text" className="aceite-input" placeholder="Seu nome completo" value={respNome} onChange={e => setRespNome(e.target.value)} />
              <input type="email" className="aceite-input" placeholder="Seu melhor email" value={respEmail} onChange={e => setRespEmail(e.target.value)} />

              {respTab === 'recusar' && (
                <textarea className="aceite-input aceite-textarea" placeholder="Motivo da recusa (obrigatório)" value={respMotivo} onChange={e => setRespMotivo(e.target.value)} rows={4} />
              )}
              {respTab === 'consideracoes' && (
                <textarea className="aceite-input aceite-textarea" placeholder="Suas considerações, dúvidas ou sugestões (obrigatório)" value={respMotivo} onChange={e => setRespMotivo(e.target.value)} rows={4} />
              )}

              {respErro && <div className="aceite-erro">{respErro}</div>}

              {respTab === 'aceitar' && (
                <button className="aceite-btn aceite-btn--aceitar" onClick={() => handleResposta('aceito')} disabled={respLoading || !respNome.trim() || !respEmail.trim()}>
                  {respLoading ? 'Enviando...' : 'Aceitar proposta e avançar'}
                </button>
              )}
              {respTab === 'consideracoes' && (
                <button className="aceite-btn aceite-btn--consideracoes" onClick={() => handleResposta('consideracoes')} disabled={respLoading || !respNome.trim() || !respEmail.trim() || !respMotivo.trim()}>
                  {respLoading ? 'Enviando...' : 'Enviar considerações'}
                </button>
              )}
              {respTab === 'recusar' && (
                <button className="aceite-btn aceite-btn--recusar" onClick={() => handleResposta('recusado')} disabled={respLoading || !respNome.trim() || !respEmail.trim() || !respMotivo.trim()}>
                  {respLoading ? 'Enviando...' : 'Recusar proposta'}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <div className="prop-cta anim-section">
        <div className="cta-glow" />
        <div className="section-tag" style={{ justifyContent: 'center' }}>Próximos passos</div>
        <h2 className="cta-title">{ctaTitulo.split('\n').map((l: string, i: number) => <span key={i}>{l}{i < ctaTitulo.split('\n').length - 1 && <br />}</span>)}</h2>
        <p className="cta-sub">{ctaTexto}</p>
        <div className="cta-btns">
          <a href="https://wa.me/5543988569827?text=Ol%C3%A1%20Valmir%2C%20quero%20avan%C3%A7ar%20com%20a%20proposta!" className="cta-btn-primary" target="_blank" rel="noopener">
            Fechar proposta via WhatsApp →
          </a>
        </div>
      </div>
    </>
  );

  // ─── Slides data ──────────────────────────────────────────────────

  const slidesData = (() => {
    const slides: { key: string; render: () => React.ReactNode }[] = [];

    // Slide 1: Hero
    slides.push({ key: 'hero', render: () => (
      <div className="sl-slide sl-hero">
        <div className="sl-hero-glow" />
        <div className="sl-hero-content">
          <div className="sl-hero-eyebrow">Proposta Técnica · {new Date().getFullYear()}</div>
          <h1 className="sl-hero-title">{cliente || 'Sua proposta'}</h1>
          <div className="sl-hero-subtitle">está pronta.</div>
          {heroMedia && (
            <div className="sl-hero-media">
              {heroMediaType === 'video'
                ? <video src={heroMedia} autoPlay muted loop playsInline />
                : <img src={heroMedia} alt="" />}
            </div>
          )}
          <div className="sl-hero-hint">
            <span>Deslize para explorar</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
    )});

    // Slide 2: Entendimento (if RE exists)
    if (re) {
      slides.push({ key: 'entendimento', render: () => (
        <div className="sl-slide sl-understand">
          <div className="sl-tag">01 — Entendemos você</div>
          <div className="sl-understand-type">{re.tipo_projeto}</div>
          <div className="sl-understand-text">{re.entendimento_do_cliente}</div>
          <div className="sl-understand-divider" />
          <div className="sl-understand-label">O que você vai ter</div>
          <div className="sl-understand-oneliner">{re.entrega_em_uma_frase}</div>
        </div>
      )});
    } else if (c?.problema_texto) {
      slides.push({ key: 'contexto', render: () => (
        <div className="sl-slide sl-understand">
          <div className="sl-tag">01 — O desafio</div>
          <div className="sl-understand-type">{c.problema_titulo}</div>
          <div className="sl-understand-text">{c.problema_texto}</div>
          <div className="sl-understand-divider" />
          <div className="sl-understand-label">A transformação</div>
          <div className="sl-understand-oneliner">{c.solucao_texto}</div>
        </div>
      )});
    }

    // Slide 3: O que recebe
    if (re?.o_que_voce_recebe) {
      slides.push({ key: 'recebe', render: () => (
        <div className="sl-slide sl-receives">
          <div className="sl-tag">02 — O que está incluso</div>
          <div className="sl-receives-list">
            {re.o_que_voce_recebe.map((item, i) => (
              <div key={i} className="sl-receives-item">
                <Check size={18} className="sl-receives-check" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          {re.o_que_nao_esta_incluso?.length > 0 && (
            <div className="sl-excludes">
              <div className="sl-excludes-label">Não incluso nesta proposta</div>
              {re.o_que_nao_esta_incluso.map((item, i) => (
                <div key={i} className="sl-excludes-item">
                  <Minus size={14} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )});
    }

    // Slide 4: Números-chave
    const numSlide = re?.numeros_chave;
    slides.push({ key: 'numeros', render: () => (
      <div className="sl-slide sl-numbers">
        <div className="sl-tag">Números-chave</div>
        <div className="sl-numbers-grid">
          <div className="sl-num-card">
            <DollarSign size={24} className="sl-num-icon" />
            <div className="sl-num-label">Investimento</div>
            <div className="sl-num-value">{numSlide?.investimento?.valor_total || investTotal}</div>
            <div className="sl-num-detail">{numSlide?.investimento?.forma_pagamento_resumida || ''}</div>
          </div>
          <div className="sl-num-card">
            <Clock size={24} className="sl-num-icon" />
            <div className="sl-num-label">Prazo</div>
            <div className="sl-num-value">{numSlide?.prazo?.duracao || `${totalSemanas} semanas`}</div>
            <div className="sl-num-detail">{numSlide?.prazo?.data_estimada_entrega || ''}</div>
          </div>
          <div className="sl-num-card">
            <LayoutGrid size={24} className="sl-num-icon" />
            <div className="sl-num-label">Escopo</div>
            <div className="sl-num-value">{numSlide?.escopo_resumido?.destaque_numerico || `${displayModulos.length} módulos`}</div>
            <div className="sl-num-detail">{numSlide?.escopo_resumido?.complemento || `${totalHoras}h de desenvolvimento`}</div>
          </div>
        </div>
      </div>
    )});

    // Slide 5: Cronograma
    if (displayCrono.length > 0) {
      slides.push({ key: 'cronograma', render: () => (
        <div className="sl-slide sl-timeline">
          <div className="sl-tag">Cronograma</div>
          <div className="sl-timeline-list">
            {displayCrono.map((fase: any, i: number) => (
              <div key={i} className="sl-tl-item">
                <div className="sl-tl-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="sl-tl-content">
                  <div className="sl-tl-name">{fase.fase}</div>
                  <div className="sl-tl-weeks">{fase.semanas} sem.</div>
                </div>
              </div>
            ))}
          </div>
          <div className="sl-tl-total">{totalSemanas} semanas no total</div>
        </div>
      )});
    }

    // Slide 6: Investimento
    slides.push({ key: 'investimento', render: () => (
      <div className="sl-slide sl-invest">
        <div className="sl-tag">Investimento</div>
        <div className="sl-invest-price">{investTotal}</div>
        <div className="sl-invest-label">Valor total do desenvolvimento</div>
        <div className="sl-invest-items">
          <div className="sl-invest-row">
            <span>{p.total_horas}h de desenvolvimento</span>
            <span>R$ 50,00/h</span>
          </div>
          <div className="sl-invest-row">
            <span>Setup + deploy + infra</span>
            <span>R$ 1.000,00</span>
          </div>
          {displayServicos.map((s: any, i: number) => (
            <div key={i} className="sl-invest-row">
              <span>{s.nome} (mensal)</span>
              <span>{s.custo}</span>
            </div>
          ))}
        </div>
        <div className="sl-invest-seal">
          <Check size={18} />
          <span>Código-fonte 100% seu · Deploy incluído</span>
        </div>
      </div>
    )});

    // Slide 7: Aceite
    slides.push({ key: 'aceite', render: () => (
      <div className="sl-slide sl-aceite">
        <div className="sl-tag">Sua resposta</div>
        <h2 className="sl-aceite-title">O que você achou?</h2>
        {respostaDefinitiva || respSucesso ? (
          <div className="sl-aceite-done" style={{
            borderColor: (respostaDefinitiva?.status || respSucesso) === 'aceito' ? 'rgba(95,208,184,0.3)' :
              (respostaDefinitiva?.status || respSucesso) === 'recusado' ? 'rgba(192,80,74,0.3)' : 'rgba(200,130,107,0.3)',
          }}>
            <CheckCircle size={40} style={{
              color: (respostaDefinitiva?.status || respSucesso) === 'aceito' ? 'var(--teal)' :
                (respostaDefinitiva?.status || respSucesso) === 'recusado' ? '#c0504a' : 'var(--bronze)',
            }} />
            <div className="sl-aceite-done-text">
              {(respostaDefinitiva?.status || respSucesso) === 'aceito' && 'Proposta aceita!'}
              {(respostaDefinitiva?.status || respSucesso) === 'recusado' && 'Proposta recusada'}
              {(respostaDefinitiva?.status || respSucesso) === 'consideracoes' && 'Considerações enviadas!'}
            </div>
          </div>
        ) : (
          <div className="sl-aceite-form">
            <div className="resp-tabs" style={{ marginBottom: '1rem' }}>
              <button className={`resp-tab${respTab === 'aceitar' ? ' resp-tab--active resp-tab--aceitar' : ''}`} onClick={() => setRespTab('aceitar')}>Aceitar</button>
              <button className={`resp-tab${respTab === 'consideracoes' ? ' resp-tab--active resp-tab--consideracoes' : ''}`} onClick={() => setRespTab('consideracoes')}>Considerações</button>
              <button className={`resp-tab${respTab === 'recusar' ? ' resp-tab--active resp-tab--recusar' : ''}`} onClick={() => setRespTab('recusar')}>Recusar</button>
            </div>
            <input type="text" className="aceite-input" placeholder="Seu nome completo" value={respNome} onChange={e => setRespNome(e.target.value)} />
            <input type="email" className="aceite-input" placeholder="Seu melhor email" value={respEmail} onChange={e => setRespEmail(e.target.value)} style={{ marginTop: '0.5rem' }} />
            {(respTab === 'recusar' || respTab === 'consideracoes') && (
              <textarea className="aceite-input aceite-textarea" placeholder={respTab === 'recusar' ? 'Motivo da recusa' : 'Suas considerações'} value={respMotivo} onChange={e => setRespMotivo(e.target.value)} rows={3} style={{ marginTop: '0.5rem' }} />
            )}
            {respErro && <div className="aceite-erro" style={{ marginTop: '0.5rem' }}>{respErro}</div>}
            <button
              className={`aceite-btn aceite-btn--${respTab === 'aceitar' ? 'aceitar' : respTab === 'recusar' ? 'recusar' : 'consideracoes'}`}
              style={{ marginTop: '0.8rem', width: '100%' }}
              onClick={() => handleResposta(respTab === 'aceitar' ? 'aceito' : respTab === 'recusar' ? 'recusado' : 'consideracoes')}
              disabled={respLoading || !respNome.trim() || !respEmail.trim() || ((respTab === 'recusar' || respTab === 'consideracoes') && !respMotivo.trim())}
            >
              {respLoading ? 'Enviando...' : respTab === 'aceitar' ? 'Aceitar proposta' : respTab === 'recusar' ? 'Recusar proposta' : 'Enviar considerações'}
            </button>
          </div>
        )}
      </div>
    )});

    // Slide 8: CTA WhatsApp
    slides.push({ key: 'cta', render: () => (
      <div className="sl-slide sl-cta">
        <div className="sl-cta-glow" />
        <h2 className="sl-cta-title">Pronto para<br />começar?</h2>
        <p className="sl-cta-text">{ctaTexto}</p>
        <a href="https://wa.me/5543988569827?text=Ol%C3%A1%20Valmir%2C%20quero%20avan%C3%A7ar%20com%20a%20proposta!" className="sl-cta-btn" target="_blank" rel="noopener">
          Falar com Valmir no WhatsApp →
        </a>
        <button className="sl-details-btn" onClick={() => setViewMode('details')}>
          Ver proposta completa ↓
        </button>
      </div>
    )});

    return slides;
  })();

  const totalSlides = slidesData.length;

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <>
      <style>{pageCSS}</style>
      <style>{slidesCSS}</style>
      {temaOverride && <style>{temaOverride}</style>}

      {viewMode === 'slides' ? (
        <div className="sl-container">
          <div className="sl-track" ref={slidesRef}>
            {slidesData.map((s) => (
              <div key={s.key} className="sl-snap">{s.render()}</div>
            ))}
          </div>
          {/* Navigation */}
          <div className="sl-nav">
            <button className="sl-arrow sl-arrow-left" onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0}><ChevronLeft size={20} /></button>
            <div className="sl-dots">
              {slidesData.map((_, i) => (
                <button key={i} className={`sl-dot${i === currentSlide ? ' sl-dot--active' : ''}`} onClick={() => goToSlide(i)} />
              ))}
            </div>
            <button className="sl-arrow sl-arrow-right" onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === totalSlides - 1}><ChevronRight size={20} /></button>
          </div>
          <div className="sl-counter">{currentSlide + 1} / {totalSlides}</div>
        </div>
      ) : (
      <div className="prop-page">
        <nav className="prop-nav">
          <a href="/" className="nav-logo" style={{ textDecoration: 'none' }}>VV<span>eronez</span>.dev</a>
          <div className="nav-tag-group">
            <div className="nav-tag">Proposta Técnica</div>
            <button className="nav-slides-btn" onClick={() => { setViewMode('slides'); setCurrentSlide(0); }}>Slides ←</button>
          </div>
        </nav>

        {/* Hero always comes first */}
        {heroSection}

        {re ? (
          <>
            {/* ═══ RESUMO EXECUTIVO (abaixo do hero) ═══ */}
            <section className="re-section">
              {/* a) Identificação */}
              <div className="re-ident">
                <div className="re-ident-label">Proposta para</div>
                <h1 className="re-name">{re.saudacao}</h1>
                <div className="re-type">{re.tipo_projeto}</div>
              </div>

              {/* b) Entendimento */}
              <div className="re-understand">
                <div className="re-understand-label">O que entendemos do seu projeto</div>
                <p className="re-understand-text">{re.entendimento_do_cliente}</p>
              </div>

              {/* c) Entrega em uma frase */}
              <div className="re-oneliner">
                <div className="re-oneliner-label">O que você vai ter</div>
                <div className="re-oneliner-text">{re.entrega_em_uma_frase}</div>
                {(re as any).entrega_imagem_url && (
                  <div className="re-oneliner-img">
                    <img src={(re as any).entrega_imagem_url} alt="" />
                  </div>
                )}
              </div>

              {/* d) 3 Cards de números */}
              <div className="re-cards">
                <div className="re-card">
                  <DollarSign size={22} className="re-card-icon" />
                  <div className="re-card-label">Investimento</div>
                  <div className="re-card-value">{re.numeros_chave.investimento.valor_total}</div>
                  <div className="re-card-detail">{re.numeros_chave.investimento.forma_pagamento_resumida}</div>
                  {re.numeros_chave.investimento.valor_mensal_recorrente && (
                    <div className="re-card-pill">+ {re.numeros_chave.investimento.valor_mensal_recorrente} recorrente</div>
                  )}
                </div>
                <div className="re-card">
                  <Clock size={22} className="re-card-icon" />
                  <div className="re-card-label">Prazo</div>
                  <div className="re-card-value">{re.numeros_chave.prazo.duracao}</div>
                  <div className="re-card-detail">{re.numeros_chave.prazo.data_estimada_entrega}</div>
                </div>
                <div className="re-card">
                  <LayoutGrid size={22} className="re-card-icon" />
                  <div className="re-card-label">Escopo</div>
                  <div className="re-card-value">{re.numeros_chave.escopo_resumido.destaque_numerico}</div>
                  <div className="re-card-detail">{re.numeros_chave.escopo_resumido.complemento}</div>
                </div>
              </div>

              {/* e) O que você recebe */}
              <div className="re-list-section">
                <div className="re-list-title">O que está incluso</div>
                <div className="re-list">
                  {re.o_que_voce_recebe.map((item, i) => (
                    <div key={i} className="re-list-item re-list-item--check">
                      <Check size={18} className="re-icon-check" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* f) O que NÃO está incluso */}
              <div className="re-list-section">
                <div className="re-list-title">O que não está incluso nesta proposta</div>
                <div className="re-list">
                  {re.o_que_nao_esta_incluso.map((item, i) => (
                    <div key={i} className="re-list-item re-list-item--exclude">
                      <Minus size={16} className="re-icon-minus" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="re-list-note">Esses itens podem ser orçados separadamente.</div>
              </div>

              {/* g) CTA → scroll to details */}
              <div className="re-action">
                <p className="re-action-text">{re.proximo_passo.texto}</p>
                <a href="#detalhes-proposta" className="re-action-btn" onClick={e => { e.preventDefault(); document.getElementById('detalhes-proposta')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  Detalhes da proposta ↓
                </a>
              </div>
            </section>

            {/* ═══ DIVIDER ═══ */}
            <div id="detalhes-proposta" className="details-divider">
              <div className="details-divider-line" />
              <div className="details-divider-center">
                <span className="details-divider-label">Detalhes da proposta</span>
                <span className="details-divider-sub">Para conhecer cada parte do projeto a fundo</span>
              </div>
              <div className="details-divider-line" />
            </div>

            {/* ═══ DETAILS ═══ */}
            <div className="details-wrapper">
              {detailsSections}
            </div>
          </>
        ) : (
          /* Modo legado — sem resumo executivo */
          detailsSections
        )}

        <footer className="prop-footer">
          <a href="/" className="footer-logo" style={{ textDecoration: 'none' }}>VV<span>eronez</span>.dev</a>
          <div className="footer-note">Proposta confidencial · © {new Date().getFullYear()}</div>
        </footer>
      </div>
      )}
    </>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────

const pageCSS = `
:root {
  --bg: #0d0c14; --bg2: #161424; --bg3: #1e1b2e;
  --border: rgba(255,255,255,0.09);
  --bronze: #c8826b; --bronze2: #e0a890; --rose: #c8839a;
  --cream: #f0e6dc; --text: #ddd8d2; --muted: #8a8494;
  --teal: #5fd0b8;
}

/* ═══ Lock Screen ═══ */
.lock-screen { min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); padding:2rem; }
.lock-card { width:100%; max-width:420px; padding:3rem 2.5rem; background:var(--bg2); border:1px solid var(--border); position:relative; overflow:hidden; }
.lock-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,var(--bronze),var(--rose),transparent); }
.lock-logo { font-family:'Cinzel',Georgia,serif; font-size:22px; font-weight:700; color:var(--cream); margin-bottom:2.5rem; display:block; }
.lock-logo span { color:var(--bronze); }
.lock-label { font-size:11px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); margin-bottom:0.5rem; }
.lock-title { font-family:'Cinzel',Georgia,serif; font-size:28px; font-weight:600; color:var(--cream); line-height:1.2; margin-bottom:2rem; }
.lock-input { width:100%; padding:14px 16px; background:var(--bg3); border:1px solid var(--border); color:var(--cream); font-family:'JetBrains Mono',monospace; font-size:16px; letter-spacing:0.1em; outline:none; transition:border-color 0.2s; margin-bottom:1rem; box-sizing:border-box; }
.lock-input:focus { border-color:var(--bronze); }
.lock-input-error { border-color:#c0504a; animation:shake 0.35s ease; }
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
.lock-error-msg { font-size:12px; color:#c0504a; margin-bottom:0.8rem; }
.lock-btn { width:100%; padding:14px; background:transparent; border:1px solid var(--bronze); color:var(--bronze2); font-size:13px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; cursor:pointer; transition:background 0.2s,color 0.2s; }
.lock-btn:hover { background:var(--bronze); color:var(--bg); }
.lock-btn:disabled { opacity:0.6; cursor:wait; }
.lock-footer { margin-top:2.5rem; font-size:11px; color:var(--muted); border-top:1px solid var(--border); padding-top:1.5rem; line-height:1.6; }

/* ═══ Page Shell ═══ */
.prop-page { background:var(--bg); color:var(--text); font-size:16px; line-height:1.75; min-height:100vh; }
.prop-nav { position:fixed; top:0; left:0; right:0; padding:1.2rem 3rem; display:flex; align-items:center; justify-content:space-between; background:rgba(13,12,20,0.88); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); z-index:100; }
.nav-logo { font-family:'Cinzel',Georgia,serif; font-size:18px; font-weight:700; color:var(--cream); }
.nav-logo span { color:var(--bronze); }
.nav-tag { font-size:11px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); border:1px solid var(--border); padding:5px 12px; border-radius:100px; }

/* ═══ RESUMO EXECUTIVO ═══ */
.re-section { max-width:780px; margin:0 auto; padding:7rem 3rem 2rem; }

/* a) Identificação */
.re-ident { margin-bottom:3rem; }
.re-ident-label { font-size:12px; font-weight:500; letter-spacing:0.25em; text-transform:uppercase; color:var(--bronze); margin-bottom:0.6rem; }
.re-name { font-family:'Cinzel',Georgia,serif; font-size:clamp(32px,5vw,48px); font-weight:400; color:var(--cream); line-height:1.15; margin:0 0 0.4rem; letter-spacing:-0.5px; }
.re-type { font-size:17px; color:var(--muted); font-weight:400; }

/* b) Entendimento */
.re-understand { margin-bottom:3rem; padding:1.5rem 2rem; border-left:4px solid var(--bronze); background:rgba(200,130,107,0.03); border-radius:0 14px 14px 0; }
.re-understand-label { font-size:11px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); margin-bottom:0.8rem; }
.re-understand-text { font-size:18px; line-height:1.7; color:var(--text); margin:0; font-weight:300; }

/* c) One-liner */
.re-oneliner { margin-bottom:3.5rem; text-align:center; padding:1.5rem 2rem; }
.re-oneliner-label { font-size:12px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); margin-bottom:1rem; }
.re-oneliner-text { font-family:'Cinzel',Georgia,serif; font-size:clamp(20px,3vw,26px); font-weight:500; color:var(--cream); line-height:1.4; max-width:60ch; margin:0 auto; }
.re-oneliner-img { margin-top:2rem; }
.re-oneliner-img img { max-width:100%; height:auto; margin:0 auto; display:block; border-radius:14px; border:1px solid var(--border); }

/* d) Number cards */
.re-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:3.5rem; }
.re-card { padding:1.8rem 1.5rem; background:var(--bg2); border:1px solid var(--border); border-radius:14px; text-align:center; transition:transform 0.2s; }
.re-card:hover { transform:translateY(-2px); }
.re-card-icon { color:var(--bronze); margin-bottom:0.8rem; opacity:0.7; }
.re-card-label { font-size:11px; font-weight:500; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted); margin-bottom:0.7rem; }
.re-card-value { font-family:'Cinzel',Georgia,serif; font-size:clamp(24px,3.5vw,32px); font-weight:600; color:var(--cream); margin-bottom:0.3rem; line-height:1.1; }
.re-card-detail { font-size:14px; color:var(--muted); line-height:1.5; }
.re-card-pill { display:inline-block; margin-top:0.6rem; padding:4px 12px; font-size:12px; font-weight:500; color:var(--bronze); background:rgba(200,130,107,0.1); border:1px solid rgba(200,130,107,0.2); border-radius:100px; }

/* e/f) Lists */
.re-list-section { margin-bottom:2.5rem; }
.re-list-title { font-family:'Cinzel',Georgia,serif; font-size:20px; font-weight:500; color:var(--cream); margin-bottom:1rem; }
.re-list { display:grid; gap:0.6rem; }
.re-list-item { display:flex; align-items:flex-start; gap:0.75rem; padding:0.9rem 1.1rem; font-size:16px; line-height:1.6; border-radius:10px; }
.re-list-item--check { background:var(--bg2); border:1px solid var(--border); color:var(--text); }
.re-list-item--exclude { background:rgba(255,255,255,0.015); color:var(--muted); font-size:15px; }
.re-icon-check { color:var(--teal); flex-shrink:0; margin-top:3px; }
.re-icon-minus { color:var(--muted); flex-shrink:0; margin-top:4px; opacity:0.6; }
.re-list-note { font-size:13px; color:var(--muted); font-style:italic; margin-top:0.6rem; padding-left:0.2rem; }

/* g) CTA */
.re-action { text-align:center; padding:2.5rem 0 1rem; }
.re-action-text { font-size:17px; color:var(--text); margin-bottom:1.5rem; font-weight:400; }
.re-action-btn { display:inline-flex; align-items:center; gap:8px; padding:16px 40px; background:var(--bronze); color:var(--bg); font-size:14px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; text-decoration:none; border-radius:12px; transition:all 0.3s; box-shadow:0 0 30px rgba(200,130,107,0.15); }
.re-action-btn:hover { background:var(--bronze2); transform:translateY(-2px); box-shadow:0 8px 40px rgba(200,130,107,0.3); }

/* ═══ DIVIDER between Resumo and Details ═══ */
.details-divider { display:flex; align-items:center; gap:2rem; max-width:780px; margin:4rem auto 3rem; padding:0 3rem; }
.details-divider-line { flex:1; height:1px; background:linear-gradient(to right,transparent,var(--border),transparent); }
.details-divider-center { text-align:center; flex-shrink:0; }
.details-divider-label { display:block; font-size:11px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--muted); }
.details-divider-sub { display:block; font-family:'Cinzel',Georgia,serif; font-size:14px; font-style:italic; color:var(--muted); margin-top:0.3rem; opacity:0.7; }

/* ═══ Details wrapper (slightly toned down) ═══ */
.details-wrapper { opacity:0.92; }
.details-wrapper .prop-section { font-size:15px; }
.details-wrapper .section-title { font-size:clamp(26px,3.5vw,38px); }
.details-wrapper .section-subtitle { font-size:15px; }

/* Compact hero when inside details */
.detail-hero { padding:4rem 3rem 3rem; position:relative; overflow:hidden; }

/* ═══ Hero (full, legacy mode) ═══ */
.prop-hero { min-height:100vh; display:flex; align-items:center; padding:8rem 3rem 4rem; position:relative; overflow:hidden; }
.hero-glow { position:absolute; top:-20%; right:-10%; width:700px; height:700px; background:radial-gradient(ellipse,rgba(200,130,107,.12) 0%,transparent 65%); pointer-events:none; }
.hero-glow-2 { position:absolute; bottom:-10%; left:-5%; width:500px; height:400px; background:radial-gradient(ellipse,rgba(200,131,154,.07) 0%,transparent 65%); pointer-events:none; }
.prop-hero-inner { max-width:960px; width:100%; margin:0 auto; position:relative; z-index:1; }
.hero-media { flex:0 0 auto; max-width:340px; border:1px solid var(--border); border-radius:16px; overflow:hidden; background:var(--bg2); box-shadow:0 20px 60px rgba(0,0,0,0.4),0 0 80px rgba(200,130,107,0.08); }
.hero-media img, .hero-media video { width:100%; height:auto; display:block; }
.hero-eyebrow { display:flex; align-items:center; gap:12px; margin-bottom:2rem; }
.hero-eyebrow-line { width:40px; height:1px; background:linear-gradient(90deg,var(--bronze),transparent); }
.hero-eyebrow-text { font-size:12px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); }
.hero-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(36px,6vw,58px); font-weight:400; line-height:1.15; letter-spacing:0.01em; color:var(--cream); margin-bottom:1.5rem; }
.hero-title em { font-style:italic; color:var(--bronze2); font-weight:300; }
.hero-sub { font-size:18px; color:var(--text); max-width:600px; line-height:1.8; margin-bottom:3rem; font-weight:300; }
.hero-sub strong { color:var(--cream); font-weight:500; }
.hero-meta { display:flex; gap:3rem; flex-wrap:wrap; }
.hero-meta-label { font-size:12px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
.hero-meta-value { font-family:'Cinzel',Georgia,serif; font-size:22px; font-weight:700; color:var(--bronze2); }
.scroll-hint { position:absolute; bottom:2rem; right:3rem; display:flex; flex-direction:column; align-items:center; gap:8px; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); }
.scroll-line { width:1px; height:40px; background:linear-gradient(to bottom,var(--bronze),transparent); animation:scrollPulse 2s ease infinite; }
@keyframes scrollPulse { 0%,100%{opacity:1;transform:scaleY(1)} 50%{opacity:0.4;transform:scaleY(0.5)} }

/* ═══ Detail Sections ═══ */
.prop-section { padding:5rem 3rem; max-width:960px; margin:0 auto; border-top:1px solid var(--border); }
.section-tag { font-size:12px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); margin-bottom:1rem; display:flex; align-items:center; gap:10px; }
.section-tag::before { content:''; width:24px; height:1px; background:var(--bronze); }
.section-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(30px,4vw,44px); font-weight:600; color:var(--cream); line-height:1.1; margin-bottom:0.8rem; }
.section-subtitle { font-size:16px; color:var(--muted); max-width:540px; margin-bottom:2.5rem; line-height:1.7; }

/* Animations */
.anim-section { opacity:0; transform:translateY(30px); animation:sectionIn 0.8s ease forwards; }
.anim-section:nth-child(2) { animation-delay:0.1s; }
.anim-section:nth-child(3) { animation-delay:0.15s; }
@keyframes sectionIn { to { opacity:1; transform:translateY(0); } }

/* Context */
.context-grid { display:grid; grid-template-columns:1fr 60px 1fr; gap:0; align-items:center; margin-top:2rem; }
.context-card { padding:2rem; background:var(--bg2); border:1px solid var(--border); border-radius:14px; position:relative; overflow:hidden; transition:transform 0.3s,box-shadow 0.3s; }
.context-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(0,0,0,0.3); }
.context-problem::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#c0504a,transparent); }
.context-solution::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--bronze),var(--rose)); }
.context-img { width:100%; height:160px; object-fit:cover; border-radius:10px; margin-bottom:1rem; }
.context-icon { font-size:28px; margin-bottom:1rem; }
.context-label { font-size:12px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:0.75rem; }
.problem-label { color:#c0504a; }
.solution-label { color:var(--bronze); }
.context-card-title { font-family:'Cinzel',Georgia,serif; font-size:19px; font-weight:600; color:var(--cream); margin-bottom:0.75rem; line-height:1.3; }
.context-text { font-size:15px; color:var(--muted); line-height:1.7; }
.context-connector { display:flex; align-items:center; justify-content:center; color:var(--bronze); opacity:0.4; }
.context-connector svg { width:50px; height:20px; }

/* Modules */
.modules-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:1px; background:var(--border); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
.module-card { background:var(--bg2); padding:1.5rem; transition:background 0.2s,transform 0.2s; position:relative; }
.module-card:hover { background:var(--bg3); transform:scale(1.01); z-index:1; }
.module-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; }
.module-icon { font-size:24px; }
.module-num { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--bronze); opacity:0.5; }
.module-name { font-size:16px; font-weight:600; color:var(--cream); margin-bottom:0.4rem; line-height:1.3; }
.module-desc { font-size:13px; color:var(--muted); line-height:1.6; margin-bottom:0.8rem; min-height:2.4em; }
.module-footer { margin-top:auto; }
.module-bar-wrap { height:3px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; margin-bottom:0.5rem; }
.module-bar { height:100%; background:linear-gradient(90deg,var(--bronze),var(--rose)); border-radius:2px; }
.module-meta { display:flex; justify-content:space-between; align-items:center; font-size:11px; }
.module-meta span:first-child { font-family:'JetBrains Mono',monospace; color:var(--muted); }
.module-fase-badge { font-size:10px; font-weight:600; letter-spacing:0.1em; padding:3px 8px; border-radius:6px; }
.module-fase-badge[data-fase="mvp"] { color:var(--teal); background:rgba(95,208,184,0.12); }
.module-fase-badge[data-fase="v1"] { color:var(--bronze2); background:rgba(200,130,107,0.12); }
.module-fase-badge[data-fase="v2"] { color:var(--muted); background:rgba(255,255,255,0.05); }
.modules-summary { display:flex; align-items:center; justify-content:center; gap:2rem; margin-top:2rem; padding:1.2rem 0; border:1px solid var(--border); border-radius:12px; background:var(--bg2); }
.summary-item { text-align:center; }
.summary-num { font-family:'Cinzel',Georgia,serif; font-size:24px; font-weight:700; color:var(--bronze2); display:block; }
.summary-label { font-size:11px; color:var(--muted); }
.summary-divider { width:1px; height:40px; background:linear-gradient(to bottom,transparent,var(--border),transparent); }

/* Stack */
.stack-grid { display:flex; flex-wrap:wrap; gap:0.6rem; margin-top:2rem; }
.stack-card { padding:10px 18px; background:var(--bg2); border:1px solid var(--border); border-radius:10px; transition:all 0.2s; cursor:default; }
.stack-card:hover { border-color:var(--bronze); transform:translateY(-2px); }
.stack-card-name { font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:500; color:var(--text); letter-spacing:0.05em; }

/* Timeline */
.timeline { margin-top:2.5rem; }
.tl-item { display:flex; gap:1.5rem; position:relative; }
.tl-marker { display:flex; flex-direction:column; align-items:center; flex-shrink:0; width:24px; }
.tl-dot { width:14px; height:14px; border-radius:50%; border:2px solid var(--bronze); background:var(--bg); flex-shrink:0; position:relative; z-index:1; }
.tl-line { width:1px; flex:1; background:linear-gradient(to bottom,var(--bronze) 0%,rgba(200,130,107,0.15) 100%); margin:4px 0; }
.tl-content { padding-bottom:2.5rem; flex:1; }
.tl-phase { font-size:10px; font-weight:600; letter-spacing:0.15em; text-transform:uppercase; color:var(--bronze); margin-bottom:4px; }
.tl-name { font-size:18px; font-weight:600; color:var(--cream); margin-bottom:0.4rem; }
.tl-desc { font-size:13px; color:var(--muted); line-height:1.6; margin-bottom:0.8rem; }
.tl-footer { display:flex; flex-wrap:wrap; align-items:center; gap:0.6rem; }
.tl-weeks { font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--bronze2); padding:5px 12px; background:rgba(200,130,107,0.08); border:1px solid rgba(200,130,107,0.15); border-radius:8px; }
.tl-deliverables { display:flex; flex-wrap:wrap; gap:0.3rem; }
.tl-tag { font-size:11px; padding:4px 10px; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:6px; color:var(--muted); }

/* Invest */
.invest-card { margin-top:2.5rem; padding:2.5rem; background:var(--bg2); border:1px solid var(--border); border-radius:16px; position:relative; overflow:hidden; }
.invest-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--bronze),var(--rose),var(--bronze2)); }
.invest-glow { position:absolute; top:-50%; right:-20%; width:400px; height:400px; background:radial-gradient(ellipse,rgba(200,130,107,0.06),transparent 70%); pointer-events:none; }
.invest-price { font-family:'Cinzel',Georgia,serif; font-size:clamp(36px,6vw,56px); font-weight:700; color:var(--cream); letter-spacing:-1px; line-height:1; margin-bottom:0.5rem; position:relative; }
.invest-label { font-size:13px; color:var(--muted); margin-bottom:2rem; }
.invest-breakdown { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:2rem; }
.invest-row { background:var(--bg3); padding:1rem 1.25rem; display:flex; justify-content:space-between; align-items:center; }
.invest-row-label { font-size:14px; color:var(--muted); }
.invest-row-value { font-family:'JetBrains Mono',monospace; font-size:14px; color:var(--cream); font-weight:500; }
.invest-note { font-size:14px; color:var(--muted); padding:1.2rem 1.5rem; background:rgba(200,130,107,0.05); border:1px solid rgba(200,130,107,0.15); border-radius:12px; line-height:1.7; margin-bottom:1.5rem; }
.invest-note strong { color:var(--cream); font-weight:600; }
.invest-seal { display:flex; align-items:center; gap:1rem; padding:1rem 1.25rem; background:rgba(95,208,184,0.04); border:1px solid rgba(95,208,184,0.12); border-radius:12px; }
.invest-seal svg { width:28px; height:28px; color:var(--teal); flex-shrink:0; }
.invest-seal strong { color:var(--cream); font-size:13px; }
.invest-seal span { font-size:12px; color:var(--muted); }

/* Risk */
.risk-card { padding:2rem; background:var(--bg2); border:1px solid rgba(200,130,107,0.2); border-radius:14px; font-size:15px; line-height:1.75; margin-top:1.5rem; }
.risk-card strong { color:var(--cream); font-weight:500; }

/* Resposta / Aceite */
.aceite-form-wrap { max-width:520px; margin:2rem auto 0; }
.resp-tabs { display:flex; gap:0; border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:1.5rem; }
.resp-tab { flex:1; padding:12px 8px; background:transparent; border:none; color:var(--muted); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; letter-spacing:0.03em; }
.resp-tab:not(:last-child) { border-right:1px solid var(--border); }
.resp-tab--active.resp-tab--aceitar { background:rgba(95,208,184,0.08); color:var(--teal); }
.resp-tab--active.resp-tab--consideracoes { background:rgba(200,130,107,0.08); color:var(--bronze); }
.resp-tab--active.resp-tab--recusar { background:rgba(192,80,74,0.08); color:#c0504a; }
.resp-desc { margin-bottom:1.5rem; }
.resp-desc p { font-size:14px; color:var(--muted); line-height:1.7; margin:0; }
.resp-desc strong { color:var(--cream); }
.aceite-form { display:grid; gap:1rem; }
.aceite-input { width:100%; padding:14px 16px; background:var(--bg3); border:1px solid var(--border); color:var(--cream); font-size:15px; outline:none; transition:border-color 0.2s; box-sizing:border-box; border-radius:10px; }
.aceite-input:focus { border-color:var(--bronze); }
.aceite-textarea { resize:vertical; min-height:100px; font-family:inherit; line-height:1.6; }
.aceite-erro { font-size:12px; color:#c0504a; }
.aceite-btn { width:100%; padding:14px; font-size:13px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; border:none; cursor:pointer; transition:all 0.3s; border-radius:10px; }
.aceite-btn:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
.aceite-btn:disabled { opacity:0.5; cursor:not-allowed; }
.aceite-btn--aceitar { background:var(--teal); color:var(--bg); }
.aceite-btn--consideracoes { background:var(--bronze); color:var(--bg); }
.aceite-btn--recusar { background:transparent; border:1px solid #c0504a; color:#c0504a; }
.aceite-btn--recusar:hover:not(:disabled) { background:rgba(192,80,74,0.1); }
.aceite-success { text-align:center; padding:3rem 2rem; border:1px solid; border-radius:16px; margin-top:2rem; }
.aceite-success-title { font-family:'Cinzel',Georgia,serif; font-size:28px; font-weight:600; margin-bottom:0.5rem; }
.aceite-success-info { font-size:14px; color:var(--muted); margin-bottom:1rem; }
.aceite-success-info span { margin:0 0.2rem; }
.aceite-success-text { font-size:15px; color:var(--muted); line-height:1.7; }

/* CTA */
.prop-cta { text-align:center; padding:6rem 3rem; border-top:1px solid var(--border); max-width:960px; margin:0 auto; position:relative; overflow:hidden; }
.cta-glow { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:500px; height:300px; background:radial-gradient(ellipse,rgba(200,130,107,0.08) 0%,transparent 70%); pointer-events:none; }
.cta-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(32px,5vw,56px); font-weight:700; color:var(--cream); letter-spacing:-1px; margin-bottom:1rem; line-height:1.1; position:relative; }
.cta-sub { font-size:15px; color:var(--muted); margin-bottom:2.5rem; position:relative; }
.cta-btns { display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; position:relative; }
.cta-btn-primary { padding:16px 36px; background:var(--bronze); color:var(--bg); font-size:13px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; border:none; cursor:pointer; text-decoration:none; transition:all 0.3s; display:inline-flex; align-items:center; gap:8px; box-shadow:0 0 30px rgba(200,130,107,0.2); }
.cta-btn-primary:hover { background:var(--bronze2); transform:translateY(-2px); }

/* Footer */
.prop-footer { border-top:1px solid var(--border); padding:2rem 3rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; max-width:960px; margin:0 auto; }
.footer-logo { font-family:'Cinzel',Georgia,serif; font-size:15px; font-weight:600; color:var(--muted); }
.footer-logo span { color:var(--bronze); }
.footer-note { font-size:11px; color:var(--muted); }

/* ═══ Responsive ═══ */
@media (max-width:700px) {
  .prop-nav { padding:1rem 1.5rem; }
  .re-section { padding:6rem 1.5rem 2rem; }
  .re-cards { grid-template-columns:1fr; }
  .prop-hero { padding:7rem 1.5rem 4rem; }
  .prop-hero-inner { flex-direction:column !important; }
  .hero-media { flex:none !important; width:100%; max-width:100%; }
  .detail-hero { padding:3rem 1.5rem 2rem; }
  .prop-section { padding:4rem 1.5rem; }
  .modules-grid { grid-template-columns:1fr; }
  .context-grid { grid-template-columns:1fr; }
  .context-connector { transform:rotate(90deg); padding:0.5rem 0; }
  .invest-breakdown { grid-template-columns:1fr; }
  .hero-meta { gap:2rem; }
  .prop-footer { flex-direction:column; }
  .prop-cta { padding:4rem 1.5rem; }
  .lock-card { padding:2rem 1.5rem; }
  .scroll-hint { display:none; }
  .modules-summary { flex-direction:column; gap:1rem; }
  .summary-divider { width:40px; height:1px; background:linear-gradient(to right,transparent,var(--border),transparent); }
  .details-divider { padding:0 1.5rem; }
}
`;

const slidesCSS = `
/* ═══ SLIDES CONTAINER ═══ */
.sl-container { position:fixed; inset:0; background:var(--bg, #0d0c14); z-index:200; overflow:hidden; }
.sl-track { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; height:100vh; width:100vw; scrollbar-width:none; -ms-overflow-style:none; }
.sl-track::-webkit-scrollbar { display:none; }
.sl-snap { flex:0 0 100vw; scroll-snap-align:start; height:100vh; overflow-y:auto; }

/* ═══ SLIDE BASE ═══ */
.sl-slide { min-height:100vh; display:flex; flex-direction:column; justify-content:center; padding:3rem 2.5rem; max-width:640px; margin:0 auto; box-sizing:border-box; }
.sl-tag { font-size:11px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze, #c8826b); margin-bottom:1.5rem; display:flex; align-items:center; gap:10px; }
.sl-tag::before { content:''; width:20px; height:1px; background:var(--bronze, #c8826b); }

/* ═══ SLIDE 1: HERO ═══ */
.sl-hero { align-items:center; text-align:center; position:relative; overflow:hidden; }
.sl-hero-glow { position:absolute; top:20%; left:50%; transform:translateX(-50%); width:500px; height:500px; background:radial-gradient(ellipse,rgba(200,130,107,0.1),transparent 65%); pointer-events:none; }
.sl-hero-content { position:relative; z-index:1; }
.sl-hero-eyebrow { font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:var(--muted, #8a8494); margin-bottom:2rem; }
.sl-hero-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(36px,8vw,56px); font-weight:400; color:var(--cream, #f0e6dc); line-height:1.1; margin:0 0 0.3rem; }
.sl-hero-subtitle { font-family:'Cinzel',Georgia,serif; font-size:clamp(28px,6vw,44px); font-weight:300; font-style:italic; color:var(--bronze2, #e0a890); margin-bottom:2rem; }
.sl-hero-media { max-width:280px; margin:0 auto 2rem; border-radius:16px; overflow:hidden; border:1px solid var(--border, rgba(255,255,255,0.09)); box-shadow:0 20px 60px rgba(0,0,0,0.4); }
.sl-hero-media img, .sl-hero-media video { width:100%; height:auto; display:block; }
.sl-hero-hint { display:flex; align-items:center; gap:6px; font-size:12px; letter-spacing:0.1em; color:var(--muted, #8a8494); animation:hintPulse 2s ease infinite; }
@keyframes hintPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

/* ═══ SLIDE 2: ENTENDIMENTO ═══ */
.sl-understand-type { font-family:'Cinzel',Georgia,serif; font-size:clamp(20px,4vw,28px); font-weight:500; color:var(--cream, #f0e6dc); line-height:1.3; margin-bottom:1.5rem; }
.sl-understand-text { font-size:16px; line-height:1.8; color:var(--text, #ddd8d2); font-weight:300; margin-bottom:2rem; }
.sl-understand-divider { width:40px; height:1px; background:var(--bronze, #c8826b); margin:0 0 2rem; }
.sl-understand-label { font-size:11px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze, #c8826b); margin-bottom:0.8rem; }
.sl-understand-oneliner { font-family:'Cinzel',Georgia,serif; font-size:clamp(18px,3vw,22px); font-weight:500; color:var(--cream, #f0e6dc); line-height:1.4; }

/* ═══ SLIDE 3: O QUE RECEBE ═══ */
.sl-receives-list { display:grid; gap:0.5rem; margin-bottom:2rem; }
.sl-receives-item { display:flex; align-items:flex-start; gap:0.75rem; padding:0.8rem 1rem; background:var(--bg2, #161424); border:1px solid var(--border, rgba(255,255,255,0.09)); border-radius:10px; font-size:15px; line-height:1.6; color:var(--text, #ddd8d2); }
.sl-receives-check { color:var(--teal, #5fd0b8); flex-shrink:0; margin-top:2px; }
.sl-excludes { margin-top:1rem; }
.sl-excludes-label { font-size:12px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted, #8a8494); margin-bottom:0.6rem; }
.sl-excludes-item { display:flex; align-items:center; gap:0.5rem; font-size:13px; color:var(--muted, #8a8494); padding:0.3rem 0; }

/* ═══ SLIDE 4: NÚMEROS ═══ */
.sl-numbers { align-items:center; text-align:center; }
.sl-numbers-grid { display:grid; gap:1rem; width:100%; }
.sl-num-card { padding:1.5rem; background:var(--bg2, #161424); border:1px solid var(--border, rgba(255,255,255,0.09)); border-radius:14px; }
.sl-num-icon { color:var(--bronze, #c8826b); margin-bottom:0.6rem; opacity:0.7; }
.sl-num-label { font-size:11px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted, #8a8494); margin-bottom:0.5rem; }
.sl-num-value { font-family:'Cinzel',Georgia,serif; font-size:clamp(24px,5vw,34px); font-weight:600; color:var(--cream, #f0e6dc); line-height:1.1; margin-bottom:0.3rem; }
.sl-num-detail { font-size:13px; color:var(--muted, #8a8494); }

/* ═══ SLIDE 5: CRONOGRAMA ═══ */
.sl-timeline-list { display:grid; gap:0.6rem; margin-bottom:1.5rem; }
.sl-tl-item { display:flex; align-items:center; gap:1rem; padding:1rem 1.2rem; background:var(--bg2, #161424); border:1px solid var(--border, rgba(255,255,255,0.09)); border-radius:12px; }
.sl-tl-num { font-family:'Cinzel',Georgia,serif; font-size:18px; font-weight:700; color:var(--bronze, #c8826b); width:32px; flex-shrink:0; text-align:center; }
.sl-tl-content { flex:1; display:flex; justify-content:space-between; align-items:center; }
.sl-tl-name { font-size:15px; font-weight:500; color:var(--cream, #f0e6dc); }
.sl-tl-weeks { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--bronze2, #e0a890); padding:4px 10px; background:rgba(200,130,107,0.08); border-radius:8px; flex-shrink:0; }
.sl-tl-total { text-align:center; font-size:14px; color:var(--muted, #8a8494); }

/* ═══ SLIDE 6: INVESTIMENTO ═══ */
.sl-invest { align-items:center; text-align:center; }
.sl-invest-price { font-family:'Cinzel',Georgia,serif; font-size:clamp(36px,8vw,52px); font-weight:700; color:var(--cream, #f0e6dc); letter-spacing:-1px; line-height:1; margin-bottom:0.4rem; }
.sl-invest-label { font-size:13px; color:var(--muted, #8a8494); margin-bottom:2rem; }
.sl-invest-items { width:100%; display:grid; gap:1px; background:var(--border, rgba(255,255,255,0.09)); border:1px solid var(--border, rgba(255,255,255,0.09)); border-radius:12px; overflow:hidden; margin-bottom:1.5rem; }
.sl-invest-row { display:flex; justify-content:space-between; padding:0.8rem 1rem; background:var(--bg2, #161424); font-size:13px; }
.sl-invest-row span:first-child { color:var(--muted, #8a8494); }
.sl-invest-row span:last-child { font-family:'JetBrains Mono',monospace; color:var(--cream, #f0e6dc); font-weight:500; }
.sl-invest-seal { display:flex; align-items:center; justify-content:center; gap:0.5rem; padding:0.8rem 1.2rem; background:rgba(95,208,184,0.05); border:1px solid rgba(95,208,184,0.15); border-radius:10px; font-size:13px; color:var(--teal, #5fd0b8); }

/* ═══ SLIDE 7: ACEITE ═══ */
.sl-aceite { align-items:center; }
.sl-aceite-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(24px,5vw,32px); font-weight:500; color:var(--cream, #f0e6dc); text-align:center; margin-bottom:1.5rem; }
.sl-aceite-form { width:100%; max-width:400px; }
.sl-aceite-done { display:flex; flex-direction:column; align-items:center; padding:2rem; border:1px solid; border-radius:14px; background:var(--bg2, #161424); gap:0.8rem; }
.sl-aceite-done-text { font-family:'Cinzel',Georgia,serif; font-size:20px; font-weight:500; color:var(--cream, #f0e6dc); }

/* ═══ SLIDE 8: CTA ═══ */
.sl-cta { align-items:center; text-align:center; position:relative; }
.sl-cta-glow { position:absolute; top:30%; left:50%; transform:translateX(-50%); width:400px; height:400px; background:radial-gradient(ellipse,rgba(200,130,107,0.08),transparent 65%); pointer-events:none; }
.sl-cta-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(28px,6vw,40px); font-weight:500; color:var(--cream, #f0e6dc); line-height:1.2; margin-bottom:1rem; position:relative; }
.sl-cta-text { font-size:16px; color:var(--muted, #8a8494); line-height:1.7; margin-bottom:2rem; max-width:400px; position:relative; }
.sl-cta-btn { display:inline-flex; padding:16px 36px; background:var(--bronze, #c8826b); color:var(--bg, #0d0c14); font-size:14px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; text-decoration:none; border-radius:12px; transition:all 0.3s; position:relative; box-shadow:0 0 30px rgba(200,130,107,0.2); }
.sl-cta-btn:hover { background:var(--bronze2, #e0a890); transform:translateY(-2px); }
.sl-details-btn { margin-top:1.5rem; background:none; border:1px solid var(--border, rgba(255,255,255,0.09)); color:var(--muted, #8a8494); padding:10px 24px; font-size:13px; cursor:pointer; border-radius:8px; transition:all 0.2s; position:relative; }
.sl-details-btn:hover { border-color:var(--bronze, #c8826b); color:var(--bronze, #c8826b); }

/* ═══ NAVIGATION ═══ */
.sl-nav { position:fixed; bottom:2rem; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:1rem; z-index:210; background:rgba(13,12,20,0.85); backdrop-filter:blur(12px); padding:0.6rem 1rem; border-radius:100px; border:1px solid var(--border, rgba(255,255,255,0.09)); }
.sl-dots { display:flex; gap:6px; }
.sl-dot { width:8px; height:8px; border-radius:50%; border:none; background:rgba(255,255,255,0.15); cursor:pointer; padding:0; transition:all 0.3s; }
.sl-dot--active { background:var(--bronze, #c8826b); width:24px; border-radius:4px; }
.sl-arrow { background:none; border:none; color:var(--muted, #8a8494); cursor:pointer; padding:4px; display:flex; align-items:center; transition:color 0.2s; }
.sl-arrow:hover:not(:disabled) { color:var(--cream, #f0e6dc); }
.sl-arrow:disabled { opacity:0.2; cursor:default; }
.sl-counter { position:fixed; top:1.5rem; right:1.5rem; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--muted, #8a8494); z-index:210; letter-spacing:0.1em; }

/* Nav detail button */
.nav-tag-group { display:flex; align-items:center; gap:0.6rem; }
.nav-slides-btn { font-size:11px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:var(--bronze, #c8826b); background:none; border:1px solid rgba(200,130,107,0.3); padding:5px 12px; border-radius:100px; cursor:pointer; transition:all 0.2s; }
.nav-slides-btn:hover { background:rgba(200,130,107,0.1); }

/* ═══ MOBILE ═══ */
@media (max-width: 640px) {
  .sl-slide { padding:2rem 1.5rem; }
  .sl-nav { bottom:1rem; padding:0.5rem 0.8rem; }
  .sl-numbers-grid { gap:0.8rem; }
}
`;

