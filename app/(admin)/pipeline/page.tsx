'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Thermometer, Clock, DollarSign } from 'lucide-react';

interface LeadCard {
  id: string;
  nome_cliente: string | null;
  temperatura: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  propostas: { id: string; custo_total_centavos: number; proposta_aceites: { id: string } | null }[];
}

type Coluna = { key: string; label: string; color: string };

const COLUNAS: Coluna[] = [
  { key: 'novo', label: 'Novo', color: '#888' },
  { key: 'qualificando', label: 'Qualificando', color: '#e0a890' },
  { key: 'qualificado', label: 'Qualificado', color: '#d4a04a' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: '#7c8cf5' },
  { key: 'aceito', label: 'Aceito', color: '#5fd0b8' },
  { key: 'frio', label: 'Frio', color: '#666' },
];

function diasInativo(dt: string): number {
  return Math.floor((Date.now() - new Date(dt).getTime()) / (1000 * 60 * 60 * 24));
}

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function classificar(lead: LeadCard): string {
  // Aceito: tem proposta com aceite
  if (lead.propostas.some(p => p.proposta_aceites)) return 'aceito';
  // Frio
  if (lead.status === 'frio' || lead.temperatura === 'frio') return 'frio';
  // Proposta enviada
  if (lead.propostas.length > 0 && lead.status === 'finalizado') return 'proposta_enviada';
  // Qualificado (finalizado mas sem proposta)
  if (lead.status === 'finalizado') return 'qualificado';
  // Qualificando
  if (lead.status === 'em_andamento') return 'qualificando';
  // Negado — não aparece
  if (lead.status === 'negado') return 'negado';
  return 'novo';
}

function tempColor(temp: string | null) {
  if (temp === 'quente') return '#e85d3a';
  if (temp === 'morno') return '#e0a040';
  if (temp === 'frio') return '#6688aa';
  return '#888';
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('leads')
        .select('id, nome_cliente, temperatura, status, created_at, updated_at, propostas(id, custo_total_centavos, proposta_aceites(id))')
        .neq('status', 'negado')
        .order('created_at', { ascending: false });
      setLeads((data ?? []) as unknown as LeadCard[]);
      setLoading(false);
    }
    load();
  }, []);

  const grouped = COLUNAS.map(col => ({
    ...col,
    leads: leads.filter(l => classificar(l) === col.key),
  }));

  return (
    <>
      <h1 className="admin-page-title">Pipeline</h1>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUNAS.length}, minmax(180px, 1fr))`,
          gap: '0.6rem',
          overflowX: 'auto',
          paddingBottom: '1rem',
        }}>
          {grouped.map(col => (
            <div key={col.key} style={{
              background: 'var(--surface-1, rgba(255,255,255,0.02))',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              borderRadius: '8px',
              padding: '0.8rem',
              minHeight: '300px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.8rem', paddingBottom: '0.6rem',
                borderBottom: `2px solid ${col.color}`,
              }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: col.color,
                  fontFamily: 'var(--font-jetbrains)',
                }}>
                  {col.label}
                </span>
                <span style={{
                  fontSize: '0.65rem', color: 'var(--text-dim)',
                  background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.4rem',
                  borderRadius: '4px', fontFamily: 'var(--font-jetbrains)',
                }}>
                  {col.leads.length}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {col.leads.map(lead => {
                  const dias = diasInativo(lead.updated_at || lead.created_at);
                  const valor = lead.propostas.reduce((a, p) => a + p.custo_total_centavos, 0);
                  return (
                    <a key={lead.id} href={`/sofia/${lead.id}`} style={{
                      display: 'block', textDecoration: 'none',
                      background: 'var(--surface-2, rgba(255,255,255,0.03))',
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                      borderRadius: '6px', padding: '0.7rem',
                      transition: 'border-color 0.2s',
                    }}>
                      <div style={{
                        fontSize: '0.82rem', fontWeight: 500,
                        color: 'var(--gold-100, #f0e6dc)',
                        marginBottom: '0.4rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {lead.nome_cliente || 'Sem nome'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {lead.temperatura && (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            fontSize: '0.62rem', color: tempColor(lead.temperatura),
                            fontFamily: 'var(--font-jetbrains)',
                          }}>
                            <Thermometer size={10} /> {lead.temperatura}
                          </span>
                        )}
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '0.2rem',
                          fontSize: '0.62rem', color: dias > 7 ? '#e85d3a' : 'var(--text-dim)',
                          fontFamily: 'var(--font-jetbrains)',
                        }}>
                          <Clock size={10} /> {dias}d
                        </span>
                        {valor > 0 && (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            fontSize: '0.62rem', color: '#5fd0b8',
                            fontFamily: 'var(--font-jetbrains)',
                          }}>
                            <DollarSign size={10} /> {formatBRL(valor)}
                          </span>
                        )}
                      </div>
                    </a>
                  );
                })}
                {col.leads.length === 0 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
