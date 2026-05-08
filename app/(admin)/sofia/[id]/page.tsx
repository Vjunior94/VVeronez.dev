'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatPhone } from '@/lib/ddd';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, MessageSquare, ClipboardList, Flame, Sun, Snowflake, Trash2,
  Briefcase, Target, TrendingUp, Users, Calendar, Wallet, GitBranch, User, StickyNote,
  AlertTriangle, Thermometer, Lightbulb, Send, Loader2, Pencil, Check, X, RotateCcw,
  Globe, Link2, Copy, Quote, Phone, Clock, Hourglass, Zap, Download,
} from 'lucide-react';
import { exportFichaPDF } from '@/lib/export-ficha-pdf';
import { exportPropostaPDF } from '@/lib/export-proposta-pdf';
import { exportPublicadaPDF } from '@/lib/export-publicada-pdf';

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

interface Mensagem {
  id: string;
  origem: string;
  tipo: string;
  conteudo: string;
  created_at: string;
}

interface ConteudoPagina {
  hero_titulo: string;
  hero_subtitulo: string;
  hero_media_url: string;
  hero_media_type: 'image' | 'video' | 'gif';
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
  senha_acesso: string | null;
  conteudo_pagina: ConteudoPagina | null;
  created_at: string;
}

interface Servico {
  id: string;
  nome: string;
  descricao: string;
  custo_mensal_centavos: number;
  obrigatorio: boolean;
}

const SOFIA_BACKEND = 'https://sofia-secretaria-production.up.railway.app';

interface Modulo {
  id: string;
  nome: string;
  descricao: string;
  complexidade: string;
  horas_estimadas: number;
  fase: string;
  ordem: number;
}

const campoConfig: Record<string, { label: string; icon: React.ReactNode; accent: string }> = {
  tipo_projeto:       { label: 'Tipo de Projeto',    icon: <Briefcase size={16} />,  accent: '#b882c9' },
  problema_objetivo:  { label: 'Problema / Objetivo', icon: <Target size={16} />,     accent: '#e85d75' },
  estagio_atual:      { label: 'Estágio Atual',       icon: <TrendingUp size={16} />, accent: '#5fd0b8' },
  tamanho_escala:     { label: 'Tamanho / Escala',    icon: <Users size={16} />,      accent: '#5ba8d4' },
  prazo:              { label: 'Prazo',                icon: <Calendar size={16} />,   accent: '#d4a04a' },
  investimento:       { label: 'Investimento',         icon: <Wallet size={16} />,     accent: '#5fd0b8' },
  decisao_contexto:   { label: 'Decisão / Contexto',  icon: <GitBranch size={16} />,  accent: '#b882c9' },
  nome_cliente:       { label: 'Nome',                 icon: <User size={16} />,       accent: '#5ba8d4' },
  observacoes_extras: { label: 'Observações',          icon: <StickyNote size={16} />, accent: '#d4a04a' },
};

const confiancaColors: Record<string, string> = {
  alta: '#5fd0b8',
  media: '#d4a04a',
  baixa: '#e85d75',
};

const tempConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  quente: { label: 'Quente', icon: <Flame size={14} />, color: '#e85d75' },
  morno: { label: 'Morno', icon: <Sun size={14} />, color: '#d4a04a' },
  frio: { label: 'Frio', icon: <Snowflake size={14} />, color: '#5ba8d4' },
};

const acaoConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  agendar_call_urgente: { label: 'Call urgente', icon: <Phone size={13} />, color: '#e85d75' },
  call_padrao: { label: 'Agendar call', icon: <Phone size={13} />, color: '#5fd0b8' },
  enviar_material_antes: { label: 'Enviar material', icon: <FileText size={13} />, color: '#d4a04a' },
  discovery_pago_primeiro: { label: 'Discovery pago', icon: <Zap size={13} />, color: '#b882c9' },
  aguardar_retorno: { label: 'Aguardar retorno', icon: <Hourglass size={13} />, color: '#5ba8d4' },
};

const fraseCategoria: Record<string, { label: string; color: string }> = {
  dor: { label: 'Dor', color: '#e85d75' },
  objetivo: { label: 'Objetivo', color: '#5fd0b8' },
  frustracao: { label: 'Frustração', color: '#d4a04a' },
  ambicao: { label: 'Ambição', color: '#b882c9' },
  contexto_negocio: { label: 'Contexto', color: '#5ba8d4' },
  outro: { label: 'Outro', color: 'var(--text-dim)' },
};

function renderMarkdown(text: string) {
  // Split by lines, render **bold** and - list items
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j} style={{ color: 'var(--gold-100)', fontWeight: 600 }}>{part}</strong> : part
    );
    const isList = line.trimStart().startsWith('- ');
    if (isList) {
      return (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <span style={{ color: 'var(--gold-500)', flexShrink: 0 }}>◆</span>
          <span>{rendered.map((r, idx) => typeof r === 'string' ? r.replace(/^-\s*/, '') : r)}</span>
        </div>
      );
    }
    return <span key={i}>{rendered}{i < text.split('\n').length - 1 && <br />}</span>;
  });
}

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ficha, setFicha] = useState<FichaCampo[]>([]);
  const [frasesOuro, setFrasesOuro] = useState<FraseOuro[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [tab, setTab] = useState<'ficha' | 'conversa' | 'proposta' | 'publicadas'>('ficha');
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [editingProposta, setEditingProposta] = useState(false);
  const [editForm, setEditForm] = useState({ custo_total_centavos: 0, total_horas: 0, observacoes: '' });
  const [editingModulo, setEditingModulo] = useState<string | null>(null);
  const [editModuloForm, setEditModuloForm] = useState({ horas_estimadas: 0 });
  const [saving, setSaving] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishSenha, setPublishSenha] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [leadRes, fichaRes, msgsRes, propRes, frasesRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).single(),
        supabase.from('ficha_campos').select('*').eq('lead_id', id).order('created_at'),
        supabase.from('mensagens').select('id,origem,tipo,conteudo,created_at')
          .eq('lead_id', id).in('tipo', ['texto', 'audio']).order('created_at'),
        supabase.from('propostas').select('*').eq('lead_id', id).order('created_at'),
        supabase.from('frases_ouro').select('*').eq('lead_id', id).order('created_at'),
      ]);

      setLead(leadRes.data);
      setFrasesOuro(frasesRes.data ?? []);
      setFicha(fichaRes.data ?? []);
      setMensagens(msgsRes.data ?? []);
      setPropostas(propRes.data ?? []);

      if (propRes.data && propRes.data.length > 0) {
        const [modsRes, servsRes] = await Promise.all([
          supabase.from('proposta_modulos').select('*').eq('proposta_id', propRes.data[0].id).order('ordem'),
          supabase.from('proposta_servicos').select('*').eq('proposta_id', propRes.data[0].id),
        ]);
        setModulos(modsRes.data ?? []);
        setServicos(servsRes.data ?? []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    await supabase.from('leads').delete().eq('id', id);
    router.push('/sofia');
  };

  const handleGerarProposta = async () => {
    if (propostas.length > 0) {
      const confirmar = window.confirm(
        `Já existem ${propostas.length} proposta(s) gerada(s).\n\nDeseja gerar uma nova proposta adicional?`
      );
      if (!confirmar) return;
    }
    setGerando(true);
    try {
      const res = await fetch(`${SOFIA_BACKEND}/api/proposta/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao gerar proposta');
      // Reload propostas
      const supabase = createClient();
      const { data: props } = await supabase.from('propostas').select('*').eq('lead_id', id).order('created_at');
      setPropostas(props ?? []);
      if (props && props.length > 0) {
        const [modsRes, servsRes] = await Promise.all([
          supabase.from('proposta_modulos').select('*').eq('proposta_id', props[0].id).order('ordem'),
          supabase.from('proposta_servicos').select('*').eq('proposta_id', props[0].id),
        ]);
        setModulos(modsRes.data ?? []);
        setServicos(servsRes.data ?? []);
      }
      setTab('proposta');
    } catch (e) {
      console.error(e);
    } finally {
      setGerando(false);
    }
  };

  const handleDeleteProposta = async (propostaId: string) => {
    const confirmar = window.confirm('Tem certeza que deseja apagar esta proposta? Essa ação não pode ser desfeita.');
    if (!confirmar) return;
    const supabase = createClient();
    await supabase.from('proposta_modulos').delete().eq('proposta_id', propostaId);
    await supabase.from('proposta_servicos').delete().eq('proposta_id', propostaId);
    await supabase.from('propostas').delete().eq('id', propostaId);
    setPropostas(prev => prev.filter(p => p.id !== propostaId));
    setModulos([]);
    setServicos([]);
  };

  const handleStartEdit = (p: Proposta) => {
    setEditForm({
      custo_total_centavos: p.custo_total_centavos,
      total_horas: p.total_horas,
      observacoes: p.observacoes || '',
    });
    setEditingProposta(true);
  };

  const handleSaveProposta = async (propostaId: string) => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('propostas').update({
      custo_total_centavos: editForm.custo_total_centavos,
      total_horas: editForm.total_horas,
      observacoes: editForm.observacoes || null,
      status: 'revisada',
    }).eq('id', propostaId);
    setPropostas(prev => prev.map(p => p.id === propostaId ? {
      ...p,
      custo_total_centavos: editForm.custo_total_centavos,
      total_horas: editForm.total_horas,
      observacoes: editForm.observacoes || null,
      status: 'revisada',
    } : p));
    setEditingProposta(false);
    setSaving(false);
  };

  const handlePublish = async (propostaId: string) => {
    if (!publishSenha.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('propostas').update({
      senha_acesso: publishSenha.trim(),
    }).eq('id', propostaId);
    const url = `${window.location.origin}/proposta/${propostaId}`;
    setPublishedUrl(url);
    setShowPublish(false);
    setSaving(false);
  };

  const handleCopyLink = () => {
    if (publishedUrl) {
      navigator.clipboard.writeText(publishedUrl);
    }
  };

  const handleSaveModulo = async (moduloId: string) => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('proposta_modulos').update({
      horas_estimadas: editModuloForm.horas_estimadas,
    }).eq('id', moduloId);
    setModulos(prev => prev.map(m => m.id === moduloId ? { ...m, horas_estimadas: editModuloForm.horas_estimadas } : m));
    setEditingModulo(null);
    setSaving(false);
  };

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>Carregando...</p>;
  if (!lead) return <p style={{ color: 'var(--text-dim)' }}>Lead não encontrado.</p>;

  const temp = tempConfig[lead.temperatura || ''];

  // Deduplicate ficha fields (keep latest)
  const fichaMap = new Map<string, FichaCampo>();
  ficha.forEach(f => fichaMap.set(f.campo, f));
  const fichaUnique = Array.from(fichaMap.values());

  const publicadas = propostas.filter(p => p.senha_acesso && p.conteudo_pagina);

  const tabs = [
    { key: 'ficha' as const, label: 'Ficha', icon: <ClipboardList size={14} /> },
    { key: 'conversa' as const, label: 'Conversa', icon: <MessageSquare size={14} /> },
    { key: 'proposta' as const, label: `Proposta${propostas.length > 0 ? ` (${propostas.length})` : ''}`, icon: <FileText size={14} /> },
    ...(publicadas.length > 0 ? [{ key: 'publicadas' as const, label: `Publicadas (${publicadas.length})`, icon: <Globe size={14} /> }] : []),
  ];

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <a href="/sofia" style={{ color: 'var(--gold-300)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </a>
        <div style={{ flex: 1 }}>
          <h1 className="admin-page-title" style={{ marginBottom: '0.3rem' }}>
            {lead.nome_cliente || formatPhone(lead.whatsapp_numero)}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.78rem' }}>
            {lead.nome_cliente && (
              <span style={{ color: 'var(--text-dim)' }}>{formatPhone(lead.whatsapp_numero)}</span>
            )}
            {temp && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: temp.color }}>
                {temp.icon} {temp.label}
              </span>
            )}
            {lead.proxima_acao_sugerida && acaoConfig[lead.proxima_acao_sugerida] && (() => {
              const acao = acaoConfig[lead.proxima_acao_sugerida!];
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  color: acao.color, background: `${acao.color}15`,
                  padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem',
                  border: `1px solid ${acao.color}30`,
                }}>
                  {acao.icon} {acao.label}
                </span>
              );
            })()}
            <span style={{ color: 'var(--text-dim)' }}>{lead.total_mensagens} mensagens</span>
            <span style={{ color: 'var(--text-dim)' }}>{formatDate(lead.created_at)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { const { doc, fileName } = exportFichaPDF(lead, ficha, frasesOuro); doc.save(fileName); }}
            style={{
              background: 'none', border: '1px solid rgba(212,160,74,0.3)', color: 'var(--gold-300)', cursor: 'pointer',
              padding: '0.4rem 0.8rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontFamily: "var(--font-jetbrains)", transition: 'all 0.2s',
            }}
            title="Exportar ficha em PDF"
          >
            <Download size={14} /> PDF
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              background: 'none', border: '1px solid rgba(220,50,50,0.3)', color: '#e88', cursor: 'pointer',
              padding: '0.4rem 0.8rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontFamily: "var(--font-jetbrains)", transition: 'all 0.2s',
            }}
            title="Apagar lead"
          >
            <Trash2 size={14} /> Apagar
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="modal-overlay active" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-container" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '2rem 2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', color: 'var(--gold-100)', marginBottom: '0.8rem', fontFamily: "var(--font-cinzel)" }}>
                Apagar lead?
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Isso vai remover <strong style={{ color: 'var(--gold-300)' }}>{lead.nome_cliente || 'este lead'}</strong> e todas as mensagens, ficha e propostas associadas. Essa ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="cases-show-all"
                  style={{ padding: '0.5rem 1.2rem', fontSize: '0.72rem' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    padding: '0.5rem 1.2rem', fontSize: '0.72rem', background: 'rgba(220,50,50,0.8)',
                    border: '1px solid rgba(220,50,50,0.5)', color: '#fff', cursor: 'pointer',
                    fontFamily: "var(--font-jetbrains)", letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}
                >
                  {deleting ? 'Apagando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo executivo */}
      {lead.resumo_executivo && (
        <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
          <div className="dash-card-label">Resumo executivo</div>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {lead.resumo_executivo}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.7rem 1.2rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--gold-500)' : '2px solid transparent',
              color: tab === t.key ? 'var(--gold-100)' : 'var(--text-dim)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
              letterSpacing: '0.05em',
              transition: 'color 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Ficha */}
      {tab === 'ficha' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Ficha fields grid */}
          {/* Nome do cliente como título destacado */}
          {(() => {
            const nomeCampo = fichaUnique.find(f => f.campo === 'nome_cliente');
            return nomeCampo ? (
              <h2 style={{
                fontSize: '1.5rem', fontFamily: "var(--font-cinzel), 'Cinzel', serif",
                color: 'var(--gold-100)', fontWeight: 600, margin: '0 0 0.2rem 0',
                letterSpacing: '0.03em',
              }}>
                {nomeCampo.valor_estruturado}
              </h2>
            ) : null;
          })()}

          {fichaUnique.filter(f => f.campo !== 'nome_cliente').length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhum campo preenchido ainda.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.8rem' }}>
              {fichaUnique.filter(f => f.campo !== 'nome_cliente').map((f) => {
                const cfg = campoConfig[f.campo];
                const accent = cfg?.accent || 'var(--gold-300)';
                return (
                  <div key={f.id} className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      marginBottom: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: '6px',
                      background: 'rgba(255,255,255,0.04)',
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '8px',
                        background: `${accent}15`, border: `1px solid ${accent}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: accent, flexShrink: 0,
                      }}>
                        {cfg?.icon || <ClipboardList size={16} />}
                      </div>
                      <span className="dash-card-label" style={{ margin: 0, flex: 1 }}>
                        {cfg?.label || f.campo}
                      </span>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: confiancaColors[f.confianca] || 'var(--text-dim)',
                        background: `${confiancaColors[f.confianca] || 'var(--text-dim)'}15`,
                        padding: '0.15rem 0.5rem', borderRadius: '4px',
                      }}>
                        {f.confianca === 'alta' ? 'Alta' : f.confianca === 'media' ? 'Média' : 'Baixa'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{f.valor_estruturado}</p>
                    {f.frase_original && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic', borderLeft: `2px solid ${accent}40`, paddingLeft: '0.6rem' }}>
                        &ldquo;{f.frase_original}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Frases de Ouro */}
          {frasesOuro.length > 0 && (
            <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                marginBottom: '0.8rem', padding: '0.5rem 0.7rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '8px',
                  background: 'rgba(212,160,74,0.1)', border: '1px solid rgba(212,160,74,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4a04a',
                }}>
                  <Quote size={16} />
                </div>
                <span className="dash-card-label" style={{ margin: 0 }}>Frases do Cliente</span>
              </div>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {frasesOuro.map((f) => {
                  const cat = fraseCategoria[f.categoria] || fraseCategoria.outro;
                  return (
                    <div key={f.id} style={{
                      padding: '0.7rem 1rem', borderLeft: `3px solid ${cat.color}`,
                      background: `${cat.color}08`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                        <span style={{
                          fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: cat.color, background: `${cat.color}15`,
                          padding: '0.1rem 0.4rem', borderRadius: '3px',
                        }}>
                          {cat.label}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-primary)', fontStyle: 'italic' }}>
                        &ldquo;{f.frase}&rdquo;
                      </p>
                      {f.por_que_importa && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                          {f.por_que_importa}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insight cards — full width */}
          {lead.alertas && (
            <div className="dash-card" style={{ borderColor: 'rgba(232, 93, 117, 0.25)', padding: '1.2rem 1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                marginBottom: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '8px',
                  background: 'rgba(232,93,117,0.1)', border: '1px solid rgba(232,93,117,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e85d75',
                }}>
                  <AlertTriangle size={16} />
                </div>
                <span className="dash-card-label" style={{ margin: 0, color: '#e85d75' }}>Alertas</span>
              </div>
              <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{lead.alertas}</p>
            </div>
          )}

          {lead.justificativa_temperatura && (
            <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                marginBottom: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '8px',
                  background: `${(temp?.color || 'var(--gold-300)')}15`, border: `1px solid ${(temp?.color || 'var(--gold-300)')}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: temp?.color || 'var(--gold-300)',
                }}>
                  <Thermometer size={16} />
                </div>
                <span className="dash-card-label" style={{ margin: 0 }}>Justificativa da temperatura</span>
              </div>
              <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{lead.justificativa_temperatura}</p>
            </div>
          )}

          {lead.tipo_solucao_sugerida && (
            <div className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                marginBottom: '0.6rem', padding: '0.5rem 0.7rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '8px',
                  background: 'rgba(212,160,74,0.1)', border: '1px solid rgba(212,160,74,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4a04a',
                }}>
                  <Lightbulb size={16} />
                </div>
                <span className="dash-card-label" style={{ margin: 0 }}>Solução sugerida</span>
              </div>
              <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{lead.tipo_solucao_sugerida}</p>
            </div>
          )}

          {/* Botão Encaminhar para Agenor */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.5rem' }}>
            <button
              onClick={handleGerarProposta}
              disabled={gerando}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.8rem 2rem',
                background: gerando ? 'rgba(212,160,74,0.1)' : 'linear-gradient(135deg, rgba(212,160,74,0.2), rgba(184,130,107,0.2))',
                border: '1px solid rgba(212,160,74,0.4)',
                color: 'var(--gold-100)',
                fontSize: '0.82rem', fontWeight: 500,
                fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: gerando ? 'wait' : 'pointer',
                transition: 'all 0.3s',
              }}
            >
              {gerando ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Agenor está gerando a proposta...
                </>
              ) : propostas.length > 0 ? (
                <>
                  <RotateCcw size={16} />
                  Regerar proposta com Agenor
                </>
              ) : (
                <>
                  <Send size={16} />
                  Encaminhar para Agenor
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Conversa */}
      {tab === 'conversa' && (
        <div className="dash-card" style={{ padding: 0, maxHeight: '65vh', overflowY: 'auto' }}>
          <div style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {mensagens.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: '1rem 0' }}>Nenhuma mensagem.</p>
            ) : (
              mensagens.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.origem === 'cliente' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                    padding: '0.6rem 0.9rem',
                    background: msg.origem === 'cliente'
                      ? 'rgba(184, 130, 107, 0.12)'
                      : 'rgba(20, 16, 30, 0.8)',
                    border: msg.origem !== 'cliente' ? '1px solid var(--border-subtle)' : 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ fontSize: '0.6rem', color: msg.origem === 'cliente' ? 'var(--gold-300)' : 'var(--text-dim)', marginBottom: '0.2rem', fontWeight: 500 }}>
                    {msg.origem === 'cliente' ? 'Cliente' : 'Sofia'}
                  </div>
                  {msg.conteudo}
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '0.25rem', textAlign: msg.origem === 'cliente' ? 'right' : 'left' }}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Proposta */}
      {tab === 'proposta' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {propostas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>Nenhuma proposta gerada.</p>
              <button
                onClick={handleGerarProposta}
                disabled={gerando}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.7rem 1.8rem',
                  background: 'linear-gradient(135deg, rgba(212,160,74,0.2), rgba(184,130,107,0.2))',
                  border: '1px solid rgba(212,160,74,0.4)', color: 'var(--gold-100)',
                  fontSize: '0.8rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: gerando ? 'wait' : 'pointer',
                }}
              >
                {gerando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</> : <><Send size={14} /> Gerar com Agenor</>}
              </button>
            </div>
          ) : (
            propostas.map((p) => (
              <div key={p.id}>
                {/* Status + Edit toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '0.2rem 0.6rem', borderRadius: '4px',
                    color: p.status === 'pronta' ? '#5fd0b8' : p.status === 'revisada' ? '#d4a04a' : 'var(--text-dim)',
                    background: p.status === 'pronta' ? 'rgba(95,208,184,0.12)' : p.status === 'revisada' ? 'rgba(212,160,74,0.12)' : 'rgba(255,255,255,0.05)',
                  }}>
                    {p.status === 'pronta' ? 'Pronta' : p.status === 'revisada' ? 'Revisada' : p.status === 'gerando' ? 'Gerando...' : p.status}
                  </span>
                  {!editingProposta ? (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleStartEdit(p)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none',
                        border: '1px solid var(--border-subtle)', color: 'var(--gold-300)',
                        padding: '0.35rem 0.8rem', fontSize: '0.7rem', cursor: 'pointer',
                        fontFamily: "var(--font-jetbrains)", letterSpacing: '0.05em',
                      }}>
                        <Pencil size={12} /> Editar
                      </button>
                      <button onClick={() => handleDeleteProposta(p.id)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none',
                        border: '1px solid rgba(220,50,50,0.3)', color: 'rgba(220,50,50,0.8)',
                        padding: '0.35rem 0.8rem', fontSize: '0.7rem', cursor: 'pointer',
                        fontFamily: "var(--font-jetbrains)", letterSpacing: '0.05em',
                      }}>
                        <Trash2 size={12} /> Apagar
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleSaveProposta(p.id)} disabled={saving} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(95,208,184,0.15)',
                        border: '1px solid rgba(95,208,184,0.3)', color: '#5fd0b8',
                        padding: '0.35rem 0.8rem', fontSize: '0.7rem', cursor: 'pointer',
                        fontFamily: "var(--font-jetbrains)",
                      }}>
                        <Check size={12} /> Salvar
                      </button>
                      <button onClick={() => setEditingProposta(false)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none',
                        border: '1px solid var(--border-subtle)', color: 'var(--text-dim)',
                        padding: '0.35rem 0.8rem', fontSize: '0.7rem', cursor: 'pointer',
                        fontFamily: "var(--font-jetbrains)",
                      }}>
                        <X size={12} /> Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {p.resumo && (
                  <div className="dash-card" style={{ marginBottom: '1rem' }}>
                    <div className="dash-card-label">Resumo</div>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-primary)' }}>{renderMarkdown(p.resumo)}</div>
                  </div>
                )}

                <div className="dashboard-grid" style={{ marginBottom: '1rem' }}>
                  <div className="dash-card">
                    <div className="dash-card-label">Custo total</div>
                    {editingProposta ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>R$</span>
                        <input
                          type="number"
                          value={editForm.custo_total_centavos / 100}
                          onChange={(e) => setEditForm(prev => ({ ...prev, custo_total_centavos: Math.round(Number(e.target.value) * 100) }))}
                          style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                            color: 'var(--gold-100)', fontSize: '1.3rem', fontFamily: "var(--font-jetbrains)",
                            padding: '0.3rem 0.6rem', width: '140px',
                          }}
                        />
                      </div>
                    ) : (
                      <div className="dash-card-value" style={{ fontSize: '1.4rem' }}>{formatBRL(p.custo_total_centavos)}</div>
                    )}
                  </div>
                  <div className="dash-card">
                    <div className="dash-card-label">Horas</div>
                    {editingProposta ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="number"
                          value={editForm.total_horas}
                          onChange={(e) => setEditForm(prev => ({ ...prev, total_horas: Number(e.target.value) }))}
                          style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                            color: 'var(--gold-100)', fontSize: '1.3rem', fontFamily: "var(--font-jetbrains)",
                            padding: '0.3rem 0.6rem', width: '100px',
                          }}
                        />
                        <span style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>h</span>
                      </div>
                    ) : (
                      <div className="dash-card-value" style={{ fontSize: '1.4rem' }}>{p.total_horas}h</div>
                    )}
                  </div>
                </div>

                {modulos.length > 0 && (
                  <div className="dash-card" style={{ marginBottom: '1rem' }}>
                    <div className="dash-card-label">Módulos</div>
                    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.6rem' }}>
                      {modulos.map((m) => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--gold-100)', fontWeight: 500 }}>{m.nome}</span>
                            {m.descricao && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{m.descricao}</p>}
                          </div>
                          {editingModulo === m.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <input
                                type="number"
                                value={editModuloForm.horas_estimadas}
                                onChange={(e) => setEditModuloForm({ horas_estimadas: Number(e.target.value) })}
                                style={{
                                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                                  color: 'var(--gold-100)', fontSize: '0.75rem', fontFamily: "var(--font-jetbrains)",
                                  padding: '0.2rem 0.4rem', width: '50px', textAlign: 'right',
                                }}
                              />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>h</span>
                              <button onClick={() => handleSaveModulo(m.id)} disabled={saving} style={{
                                background: 'none', border: 'none', color: '#5fd0b8', cursor: 'pointer', padding: '0.2rem',
                              }}>
                                <Check size={14} />
                              </button>
                              <button onClick={() => setEditingModulo(null)} style={{
                                background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.2rem',
                              }}>
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                                {m.horas_estimadas}h · {m.fase?.toUpperCase()}
                              </span>
                              {editingProposta && (
                                <button onClick={() => { setEditingModulo(m.id); setEditModuloForm({ horas_estimadas: m.horas_estimadas }); }} style={{
                                  background: 'none', border: 'none', color: 'var(--gold-300)', cursor: 'pointer', padding: '0.2rem',
                                }}>
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {servicos.length > 0 && (
                  <div className="dash-card" style={{ marginBottom: '1rem' }}>
                    <div className="dash-card-label">Serviços externos (custo mensal)</div>
                    <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.6rem' }}>
                      {servicos.map((s) => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--gold-100)', fontWeight: 500 }}>{s.nome}</span>
                            {s.descricao && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{s.descricao}</p>}
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                            {formatBRL(s.custo_mensal_centavos)}/mês
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observações editáveis */}
                {(editingProposta || p.observacoes) && (
                  <div className="dash-card" style={{ marginBottom: '1rem' }}>
                    <div className="dash-card-label">Observações</div>
                    {editingProposta ? (
                      <textarea
                        value={editForm.observacoes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, observacoes: e.target.value }))}
                        rows={3}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'inherit',
                          padding: '0.6rem', resize: 'vertical', lineHeight: 1.6,
                        }}
                        placeholder="Adicionar observações sobre a proposta..."
                      />
                    ) : (
                      <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{renderMarkdown(p.observacoes!)}</div>
                    )}
                  </div>
                )}

                {p.riscos && (
                  <div className="dash-card" style={{ borderColor: 'rgba(220, 150, 50, 0.3)' }}>
                    <div className="dash-card-label" style={{ color: '#d4a04a' }}>Riscos</div>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{renderMarkdown(p.riscos)}</div>
                  </div>
                )}

                {/* Gerador de Proposta */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center', gap: '0.8rem' }}>
                  <a href={`/propostas/revisar/${p.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.7rem 1.8rem',
                    background: 'linear-gradient(135deg, rgba(95,208,184,0.15), rgba(91,168,212,0.15))',
                    border: '1px solid rgba(95,208,184,0.3)', color: '#5fd0b8',
                    fontSize: '0.8rem', fontFamily: "var(--font-jetbrains)",
                    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                    textDecoration: 'none',
                  }}>
                    <FileText size={16} /> Gerador de Proposta
                  </a>
                  <button
                    onClick={() => { const { doc, fileName } = exportPropostaPDF(lead, p, modulos, servicos); doc.save(fileName); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.7rem 1.8rem',
                      background: 'none',
                      border: '1px solid rgba(212,160,74,0.3)', color: 'var(--gold-300)',
                      fontSize: '0.8rem', fontFamily: "var(--font-jetbrains)",
                      letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                    }}
                  >
                    <Download size={16} /> Exportar PDF
                  </button>
                  {publishedUrl && (
                    <button onClick={handleCopyLink} style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      background: 'none', border: '1px solid rgba(95,208,184,0.25)',
                      color: '#5fd0b8', padding: '0.7rem 1rem', fontSize: '0.7rem',
                      cursor: 'pointer', fontFamily: "var(--font-jetbrains)",
                    }}>
                      <Copy size={12} /> Link público
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Publicadas */}
      {tab === 'publicadas' && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {publicadas.map((p) => {
            const cp = p.conteudo_pagina!;
            const re = cp.resumo_executivo;
            return (
              <div key={p.id} className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Hero */}
                <div style={{
                  padding: '1.5rem 1.8rem', background: 'linear-gradient(135deg, rgba(200,130,107,0.12), rgba(200,131,154,0.08))',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontFamily: "var(--font-cinzel)", color: 'var(--gold-100)', margin: 0, lineHeight: 1.3 }}>
                        {cp.hero_titulo}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{cp.hero_subtitulo}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <a
                        href={`/proposta/${p.id}`}
                        target="_blank"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                          background: 'none', border: '1px solid rgba(95,208,184,0.3)',
                          color: '#5fd0b8', textDecoration: 'none',
                          fontFamily: "var(--font-jetbrains)", letterSpacing: '0.05em',
                        }}
                      >
                        <Globe size={12} /> Ver
                      </a>
                      <a
                        href={`/propostas/editor/${p.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--gold-300)', textDecoration: 'none',
                          fontFamily: "var(--font-jetbrains)", letterSpacing: '0.05em',
                        }}
                      >
                        <Pencil size={12} /> Editar
                      </a>
                      <button
                        onClick={() => { const { doc, fileName } = exportPublicadaPDF(lead!, cp); doc.save(fileName); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                          background: 'none', border: '1px solid rgba(212,160,74,0.3)',
                          color: 'var(--gold-300)', cursor: 'pointer',
                          fontFamily: "var(--font-jetbrains)", letterSpacing: '0.05em',
                        }}
                      >
                        <Download size={12} /> PDF
                      </button>
                    </div>
                  </div>
                  {/* Senha + link */}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    <span>Senha: <strong style={{ color: 'var(--gold-300)' }}>{cp.senha_acesso}</strong></span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/proposta/${p.id}`); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', padding: 0 }}
                    >
                      <Copy size={11} /> Copiar link
                    </button>
                  </div>
                </div>

                <div style={{ padding: '1.2rem 1.8rem', display: 'grid', gap: '1rem' }}>
                  {/* Resumo Executivo */}
                  {re && (
                    <div>
                      <div className="dash-card-label">Resumo Executivo</div>
                      <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                        {re.entendimento_do_cliente}
                      </p>
                      <p style={{ fontSize: '0.82rem', color: 'var(--gold-300)', fontStyle: 'italic' }}>
                        {re.entrega_em_uma_frase}
                      </p>

                      {/* Numeros chave */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginTop: '0.8rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Investimento</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gold-100)' }}>{re.numeros_chave.investimento.valor_total}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{re.numeros_chave.investimento.forma_pagamento_resumida}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Prazo</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#5fd0b8' }}>{re.numeros_chave.prazo.duracao}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{re.numeros_chave.prazo.data_estimada_entrega}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Escopo</div>
                          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#5ba8d4' }}>{re.numeros_chave.escopo_resumido.destaque_numerico}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{re.numeros_chave.escopo_resumido.complemento}</div>
                        </div>
                      </div>

                      {/* O que voce recebe */}
                      {re.o_que_voce_recebe && re.o_que_voce_recebe.length > 0 && (
                        <div style={{ marginTop: '0.8rem' }}>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>O que voce recebe</div>
                          <div style={{ display: 'grid', gap: '0.25rem' }}>
                            {re.o_que_voce_recebe.map((item, i) => (
                              <div key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                <span style={{ color: '#5fd0b8', flexShrink: 0 }}>+</span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Problema / Solucao */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <div>
                      <div className="dash-card-label" style={{ color: '#e85d75' }}>{cp.problema_titulo}</div>
                      <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{cp.problema_texto}</p>
                    </div>
                    <div>
                      <div className="dash-card-label" style={{ color: '#5fd0b8' }}>{cp.solucao_titulo}</div>
                      <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{cp.solucao_texto}</p>
                    </div>
                  </div>

                  {/* Modulos */}
                  {cp.modulos && cp.modulos.length > 0 && (
                    <div>
                      <div className="dash-card-label">Escopo ({cp.modulos.length} modulos)</div>
                      <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>
                        {cp.modulos.map((m, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: '0.82rem', color: 'var(--gold-100)', fontWeight: 500 }}>{m.nome}</span>
                              {m.descricao && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{m.descricao}</p>}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                              {m.horas}h | {m.fase}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cronograma */}
                  {cp.cronograma && cp.cronograma.length > 0 && (
                    <div>
                      <div className="dash-card-label">Cronograma</div>
                      <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem' }}>
                        {cp.cronograma.map((etapa, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.7rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: 'rgba(212,160,74,0.15)', border: '1px solid rgba(212,160,74,0.3)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.7rem', fontWeight: 600, color: 'var(--gold-300)',
                            }}>
                              {i + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.82rem', color: 'var(--gold-100)', fontWeight: 500 }}>{etapa.fase}</div>
                              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{etapa.descricao}</p>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#5fd0b8', whiteSpace: 'nowrap' }}>{etapa.semanas} sem.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investimento + Servicos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <div style={{ background: 'rgba(212,160,74,0.06)', padding: '0.8rem 1rem', borderRadius: '6px', border: '1px solid rgba(212,160,74,0.15)' }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Investimento</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--gold-100)' }}>{cp.investimento_total}</div>
                      {cp.investimento_nota && <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>{cp.investimento_nota}</p>}
                    </div>
                    {cp.servicos && cp.servicos.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Servicos mensais</div>
                        {cp.servicos.map((s, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-primary)', padding: '0.2rem 0' }}>
                            <span>{s.nome}</span>
                            <span style={{ color: 'var(--text-dim)' }}>{s.custo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Riscos */}
                  {cp.riscos && (
                    <div>
                      <div className="dash-card-label" style={{ color: '#d4a04a' }}>Riscos</div>
                      <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{cp.riscos}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
