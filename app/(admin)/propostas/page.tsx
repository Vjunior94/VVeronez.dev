'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCachedFetch } from '@/lib/use-cached-fetch';
import { formatBRL } from '@/lib/format';
import {
  Globe, Copy, ExternalLink, Lock, Unlock, Trash2, Pencil, Eye,
  CheckCircle, XCircle, MessageCircle, Plus, FileText, Search,
} from 'lucide-react';

interface Proposta {
  id: string;
  lead_id: string;
  status: string;
  resumo: string | null;
  custo_total_centavos: number;
  total_horas: number;
  senha_acesso: string | null;
  ultimo_acesso_cliente: string | null;
  created_at: string;
  leads: { nome_cliente: string | null; whatsapp_numero: string } | null;
  proposta_aceites: { nome: string; aceito_em: string; status: string }[] | null;
}

interface AgenorProposal {
  id: string;
  client_name: string;
  briefing: string;
  status: string;
  created_at: string;
}

type FilterKey = 'todas' | 'publicadas' | 'rascunho' | 'aceitas' | 'manuais';

export default function PropostasPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ client_name: '', briefing: '' });
  const [submitting, setSubmitting] = useState(false);

  const [cached, loading] = useCachedFetch('propostas-unified', async () => {
    const supabase = createClient();
    const [propRes, agenorRes] = await Promise.all([
      supabase.from('propostas')
        .select('id, lead_id, status, resumo, custo_total_centavos, total_horas, senha_acesso, ultimo_acesso_cliente, created_at, leads(nome_cliente, whatsapp_numero), proposta_aceites(nome, aceito_em, status)')
        .order('created_at', { ascending: false }),
      supabase.from('agenor_proposals').select('*').order('created_at', { ascending: false }),
    ]);
    return {
      propostas: (propRes.data ?? []) as unknown as Proposta[],
      manuais: (agenorRes.data ?? []) as AgenorProposal[],
    };
  });

  const [localPropostas, setLocalPropostas] = useState<Proposta[] | null>(null);
  const [localManuais, setLocalManuais] = useState<AgenorProposal[] | null>(null);
  const propostas = localPropostas ?? cached?.propostas ?? [];
  const manuais = localManuais ?? cached?.manuais ?? [];

  // Filters
  const publicadas = propostas.filter(p => p.senha_acesso);
  const rascunho = propostas.filter(p => !p.senha_acesso);
  const aceitas = propostas.filter(p => p.proposta_aceites?.some(a => a.status === 'aceito'));

  const filteredPropostas = filter === 'publicadas' ? publicadas
    : filter === 'rascunho' ? rascunho
    : filter === 'aceitas' ? aceitas
    : filter === 'manuais' ? []
    : propostas;

  const searchedPropostas = search
    ? filteredPropostas.filter(p => (p.leads?.nome_cliente || '').toLowerCase().includes(search.toLowerCase()))
    : filteredPropostas;

  const searchedManuais = filter === 'todas' || filter === 'manuais'
    ? (search ? manuais.filter(m => m.client_name.toLowerCase().includes(search.toLowerCase())) : manuais)
    : [];

  const stats = {
    todas: propostas.length + manuais.length,
    publicadas: publicadas.length,
    rascunho: rascunho.length,
    aceitas: aceitas.length,
    manuais: manuais.length,
  };

  const filterButtons: { key: FilterKey; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: stats.todas },
    { key: 'publicadas', label: 'Publicadas', count: stats.publicadas },
    { key: 'rascunho', label: 'Rascunho', count: stats.rascunho },
    { key: 'aceitas', label: 'Aceitas', count: stats.aceitas },
    { key: 'manuais', label: 'Manuais', count: stats.manuais },
  ];

  const handleCopy = (id: string) => {
    const url = `${window.location.origin}/proposta/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUnpublish = async (id: string) => {
    if (!confirm('Remover link publico desta proposta?')) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('propostas').update({ senha_acesso: null, conteudo_pagina: null }).eq('id', id);
    setLocalPropostas(prev => (prev ?? propostas).map(p => p.id === id ? { ...p, senha_acesso: null } : p));
    setDeletingId(null);
  };

  const handleQuickPublish = (id: string) => {
    router.push(`/propostas/editor/${id}`);
  };

  const handleDeleteProposta = async (id: string) => {
    if (!confirm('Apagar esta proposta e todos os dados associados?')) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('propostas').delete().eq('id', id);
    setLocalPropostas(prev => (prev ?? propostas).filter(p => p.id !== id));
    setDeletingId(null);
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_name || !formData.briefing) return;
    setSubmitting(true);
    const supabase = createClient();
    await supabase.from('agenor_proposals').insert({
      client_name: formData.client_name,
      briefing: formData.briefing,
      scope: { tasks: [], deliverables: [] },
      pricing: { total: 0, breakdown: [] },
      timeline: { weeks: 0, milestones: [] },
      status: 'draft',
    });
    setFormData({ client_name: '', briefing: '' });
    setShowForm(false);
    setSubmitting(false);
    // Reload
    const supabase2 = createClient();
    const { data } = await supabase2.from('agenor_proposals').select('*').order('created_at', { ascending: false });
    setLocalManuais((data ?? []) as AgenorProposal[]);
  };

  function getAceiteStatus(p: Proposta) {
    const aceites = p.proposta_aceites || [];
    const aceito = aceites.find(a => a.status === 'aceito');
    const recusado = aceites.find(a => a.status === 'recusado');
    const consideracoes = aceites.find(a => a.status === 'consideracoes');
    if (aceito) return { label: 'Aceita', color: '#5fd0b8', bg: 'rgba(95,208,184,0.1)', border: 'rgba(95,208,184,0.25)', icon: CheckCircle };
    if (recusado) return { label: 'Recusada', color: '#e88', bg: 'rgba(220,50,50,0.1)', border: 'rgba(220,50,50,0.25)', icon: XCircle };
    if (consideracoes) return { label: 'Consideracoes', color: 'var(--gold-300)', bg: 'rgba(212,160,74,0.1)', border: 'rgba(212,160,74,0.25)', icon: MessageCircle };
    return null;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Propostas</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <a href="/propostas/acessos" style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'none', border: '1px solid var(--border-subtle)',
            color: 'var(--gold-300)', padding: '0.4rem 0.8rem', fontSize: '0.72rem',
            textDecoration: 'none', fontFamily: "var(--font-jetbrains)",
            letterSpacing: '0.05em',
          }}>
            <Eye size={14} /> Acessos
          </a>
          <button
            className="cases-show-all"
            style={{ padding: '0.5rem 1rem', fontSize: '0.72rem' }}
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={14} /> Nova manual
          </button>
        </div>
      </div>

      {/* Form nova proposta manual */}
      {showForm && (
        <form
          onSubmit={handleSubmitManual}
          className="dash-card"
          style={{ marginBottom: '1.5rem', display: 'grid', gap: '1.2rem' }}
        >
          <div className="login-field">
            <label htmlFor="client_name">Nome do cliente</label>
            <input id="client_name" type="text" value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} placeholder="Empresa ou nome do cliente" required />
          </div>
          <div className="login-field">
            <label htmlFor="briefing">Briefing</label>
            <textarea id="briefing" value={formData.briefing} onChange={(e) => setFormData({ ...formData, briefing: e.target.value })} placeholder="Descreva o projeto..." required rows={4} style={{
              width: '100%', padding: '0.9rem 1rem', background: 'rgba(10, 8, 20, 0.6)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: "var(--font-manrope), sans-serif", fontSize: '0.95rem', resize: 'vertical', outline: 'none',
            }} />
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
            <button type="button" className="cases-show-all" style={{ padding: '0.5rem 1rem', fontSize: '0.72rem' }} onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="login-submit" style={{ width: 'auto', padding: '0.6rem 1.5rem', fontSize: '0.78rem' }} disabled={submitting}>{submitting ? 'Criando...' : 'Criar proposta'}</button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {filterButtons.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '0.4rem 0.8rem', fontSize: '0.72rem', cursor: 'pointer',
              background: filter === f.key ? 'rgba(184, 130, 107, 0.15)' : 'none',
              border: `1px solid ${filter === f.key ? 'var(--gold-500)' : 'var(--border-subtle)'}`,
              color: filter === f.key ? 'var(--gold-300)' : 'var(--text-dim)',
              fontFamily: 'var(--font-jetbrains)', letterSpacing: '0.05em',
            }}
          >
            {f.label} <span style={{ opacity: 0.6, marginLeft: '0.3rem' }}>{loading ? '--' : f.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.2rem', position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome do cliente..."
          style={{
            width: '100%', padding: '0.6rem 0.8rem 0.6rem 2.4rem',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
            color: 'var(--gold-100)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p>
      ) : (
        <>
          {/* Propostas de leads */}
          {searchedPropostas.length > 0 && (
            <div style={{ display: 'grid', gap: '0.7rem', marginBottom: '2rem' }}>
              {filter !== 'manuais' && (
                <div style={{
                  fontSize: '0.72rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.15em',
                  color: 'var(--gold-300)', textTransform: 'uppercase', marginBottom: '0.3rem',
                }}>
                  Propostas de leads ({searchedPropostas.length})
                </div>
              )}
              {searchedPropostas.map(p => {
                const aceiteStatus = getAceiteStatus(p);
                const AceiteIcon = aceiteStatus?.icon;
                return (
                  <div key={p.id} className="dash-card" style={{
                    padding: '1rem 1.5rem',
                    borderColor: p.senha_acesso ? 'rgba(95,208,184,0.15)' : undefined,
                    opacity: p.senha_acesso ? 1 : 0.8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.95rem', color: 'var(--gold-100)', fontWeight: 500 }}>
                            {p.leads?.nome_cliente || 'Cliente sem nome'}
                          </span>
                          {p.senha_acesso && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6rem', color: '#5fd0b8', background: 'rgba(95,208,184,0.1)', border: '1px solid rgba(95,208,184,0.25)', padding: '0.1rem 0.4rem', fontFamily: 'var(--font-jetbrains)' }}>
                              <Unlock size={10} /> Publicada
                            </span>
                          )}
                          {!p.senha_acesso && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.4rem', fontFamily: 'var(--font-jetbrains)' }}>
                              <Lock size={10} /> Rascunho
                            </span>
                          )}
                          {aceiteStatus && AceiteIcon && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.6rem', fontWeight: 600, color: aceiteStatus.color, background: aceiteStatus.bg, border: `1px solid ${aceiteStatus.border}`, padding: '0.1rem 0.4rem', fontFamily: 'var(--font-jetbrains)' }}>
                              <AceiteIcon size={10} /> {aceiteStatus.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                          <span>{formatBRL(p.custo_total_centavos)}</span>
                          <span>{p.total_horas}h</span>
                          {p.senha_acesso && <span>Senha: <code style={{ color: 'var(--gold-300)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.3rem' }}>{p.senha_acesso}</code></span>}
                          {p.ultimo_acesso_cliente && <span style={{ color: '#5fd0b8' }}>Acessada {new Date(p.ultimo_acesso_cliente).toLocaleDateString('pt-BR')}</span>}
                          {p.senha_acesso && !p.ultimo_acesso_cliente && <span style={{ color: 'var(--text-dim)' }}>Nunca acessada</span>}
                          <span style={{ color: 'var(--text-dim)' }}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <a href={`/propostas/editor/${p.id}`} style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: 'rgba(212,160,74,0.1)', border: '1px solid rgba(212,160,74,0.25)',
                          color: 'var(--gold-300)', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                          textDecoration: 'none', fontFamily: "var(--font-jetbrains)",
                        }}>
                          <Pencil size={12} /> Editar
                        </a>
                        {p.senha_acesso && (
                          <>
                            <button onClick={() => handleCopy(p.id)} style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              background: 'none', border: '1px solid var(--border-subtle)',
                              color: copiedId === p.id ? '#5fd0b8' : 'var(--gold-300)',
                              padding: '0.35rem 0.7rem', fontSize: '0.68rem', cursor: 'pointer',
                              fontFamily: "var(--font-jetbrains)",
                            }}>
                              <Copy size={12} /> {copiedId === p.id ? 'Copiado!' : 'Link'}
                            </button>
                            <a href={`/proposta/${p.id}`} target="_blank" rel="noopener" style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              background: 'rgba(95,208,184,0.1)', border: '1px solid rgba(95,208,184,0.25)',
                              color: '#5fd0b8', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                              textDecoration: 'none', fontFamily: "var(--font-jetbrains)",
                            }}>
                              <ExternalLink size={12} /> Abrir
                            </a>
                            <button onClick={() => handleUnpublish(p.id)} disabled={deletingId === p.id} style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              background: 'none', border: '1px solid rgba(220,50,50,0.25)',
                              color: '#e88', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                              cursor: 'pointer', fontFamily: "var(--font-jetbrains)",
                            }}>
                              <Trash2 size={12} /> Despublicar
                            </button>
                          </>
                        )}
                        {!p.senha_acesso && (
                          <>
                            <button onClick={() => handleQuickPublish(p.id)} style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              background: 'rgba(95,208,184,0.1)', border: '1px solid rgba(95,208,184,0.25)',
                              color: '#5fd0b8', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                              cursor: 'pointer', fontFamily: "var(--font-jetbrains)",
                            }}>
                              <Pencil size={12} /> Revisar & Publicar
                            </button>
                            <a href={`/leads/${p.lead_id}`} style={{
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              background: 'none', border: '1px solid var(--border-subtle)',
                              color: 'var(--text-dim)', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                              textDecoration: 'none', fontFamily: "var(--font-jetbrains)",
                            }}>
                              Lead
                            </a>
                          </>
                        )}
                        <button onClick={() => handleDeleteProposta(p.id)} disabled={deletingId === p.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: 'none', border: '1px solid rgba(220,50,50,0.15)',
                          color: '#e88', padding: '0.35rem 0.5rem', fontSize: '0.68rem',
                          cursor: 'pointer', opacity: deletingId === p.id ? 0.5 : 0.6,
                        }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Propostas manuais */}
          {searchedManuais.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.72rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.15em',
                color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.8rem',
              }}>
                Propostas manuais ({searchedManuais.length})
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Status</th>
                      <th>Briefing</th>
                      <th>Criada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedManuais.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.client_name}</td>
                        <td>
                          <span className={`status-badge ${p.status === 'sent' ? 'status-active' : p.status === 'accepted' ? 'status-qualified' : p.status === 'rejected' ? 'status-archived' : ''}`}>
                            {p.status === 'draft' ? 'Rascunho' : p.status === 'sent' ? 'Enviada' : p.status === 'accepted' ? 'Aceita' : p.status === 'rejected' ? 'Recusada' : p.status}
                          </span>
                        </td>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {p.briefing}
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {searchedPropostas.length === 0 && searchedManuais.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhuma proposta encontrada.</p>
          )}
        </>
      )}
    </>
  );
}
