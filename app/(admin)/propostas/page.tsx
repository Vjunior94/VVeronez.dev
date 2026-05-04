'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Globe, Copy, ExternalLink, Lock, Unlock, Trash2 } from 'lucide-react';

interface PropostaPublicada {
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
}

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PropostasPublicadasPage() {
  const [propostas, setPropostas] = useState<PropostaPublicada[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleUnpublish = async (id: string) => {
    if (!confirm('Remover link público desta proposta?')) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from('propostas').update({ senha_acesso: null, conteudo_pagina: null }).eq('id', id);
    setPropostas(prev => prev.map(p => p.id === id ? { ...p, senha_acesso: null } : p));
    setDeletingId(null);
  };

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('propostas')
        .select('id, lead_id, status, resumo, custo_total_centavos, total_horas, senha_acesso, ultimo_acesso_cliente, created_at, leads(nome_cliente, whatsapp_numero)')
        .order('created_at', { ascending: false });
      setPropostas((data ?? []) as unknown as PropostaPublicada[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleCopy = (id: string) => {
    const url = `${window.location.origin}/proposta/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickPublish = async (id: string) => {
    const senha = prompt('Defina a senha de acesso para o cliente:');
    if (!senha) return;
    setPublishingId(id);
    const supabase = createClient();
    await supabase.from('propostas').update({ senha_acesso: senha }).eq('id', id);
    setPropostas(prev => prev.map(p => p.id === id ? { ...p, senha_acesso: senha } : p));
    setPublishingId(null);
    const url = `${window.location.origin}/proposta/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const publicadas = propostas.filter(p => p.senha_acesso);
  const naoPublicadas = propostas.filter(p => !p.senha_acesso);

  return (
    <>
      <h1 className="admin-page-title">Propostas Publicadas</h1>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p>
      ) : propostas.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Nenhuma proposta gerada ainda.</p>
      ) : (
        <>
          {/* Publicadas */}
          {publicadas.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
                fontSize: '0.72rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.15em',
                color: '#5fd0b8', textTransform: 'uppercase',
              }}>
                <Unlock size={14} /> Com link público ({publicadas.length})
              </div>
              <div style={{ display: 'grid', gap: '0.8rem' }}>
                {publicadas.map(p => (
                  <div key={p.id} className="dash-card" style={{ padding: '1.2rem 1.5rem', borderColor: 'rgba(95,208,184,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1rem', color: 'var(--gold-100)', fontWeight: 500, marginBottom: '0.3rem' }}>
                          {p.leads?.nome_cliente || 'Cliente sem nome'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          {formatBRL(p.custo_total_centavos)} · {p.total_horas}h · Senha: <code style={{ color: 'var(--gold-300)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.4rem' }}>{p.senha_acesso}</code>
                          {p.ultimo_acesso_cliente && (
                            <span style={{ marginLeft: '0.5rem', color: '#5fd0b8' }}>
                              · Acessada {new Date(p.ultimo_acesso_cliente).toLocaleDateString('pt-BR')} às {new Date(p.ultimo_acesso_cliente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {!p.ultimo_acesso_cliente && <span style={{ marginLeft: '0.5rem', color: 'var(--text-dim)' }}>· Nunca acessada</span>}
                        </div>
                        {p.resumo && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.resumo}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button onClick={() => handleCopy(p.id)} style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: copiedId === p.id ? '#5fd0b8' : 'var(--gold-300)',
                          padding: '0.35rem 0.7rem', fontSize: '0.68rem', cursor: 'pointer',
                          fontFamily: "var(--font-jetbrains)",
                        }}>
                          <Copy size={12} /> {copiedId === p.id ? 'Copiado!' : 'Copiar link'}
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Não publicadas */}
          {naoPublicadas.length > 0 && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
                fontSize: '0.72rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.15em',
                color: 'var(--text-dim)', textTransform: 'uppercase',
              }}>
                <Lock size={14} /> Sem link público ({naoPublicadas.length})
              </div>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {naoPublicadas.map(p => (
                  <div key={p.id} className="dash-card" style={{ padding: '1rem 1.5rem', opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.9rem', color: 'var(--gold-100)', fontWeight: 500 }}>
                          {p.leads?.nome_cliente || 'Cliente sem nome'}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginLeft: '1rem' }}>
                          {formatBRL(p.custo_total_centavos)} · {p.total_horas}h
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <a href={`/propostas/editor/${p.id}`} style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--gold-300)', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                          textDecoration: 'none', fontFamily: "var(--font-jetbrains)",
                        }}>
                          Editar
                        </a>
                        <button onClick={() => handleQuickPublish(p.id)} disabled={publishingId === p.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: 'rgba(95,208,184,0.1)', border: '1px solid rgba(95,208,184,0.25)',
                          color: '#5fd0b8', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                          cursor: 'pointer', fontFamily: "var(--font-jetbrains)",
                        }}>
                          <Globe size={12} /> {publishingId === p.id ? 'Publicando...' : copiedId === p.id ? 'Link copiado!' : 'Publicar'}
                        </button>
                        <a href={`/sofia/${p.lead_id}`} style={{
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          background: 'none', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-dim)', padding: '0.35rem 0.7rem', fontSize: '0.68rem',
                          textDecoration: 'none', fontFamily: "var(--font-jetbrains)",
                        }}>
                          Lead
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
