'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, MapPin, Clock, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Acesso {
  id: string;
  proposta_id: string;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface PropostaInfo {
  id: string;
  leads: { nome_cliente: string | null } | null;
}

export default function AcessosPage() {
  const router = useRouter();
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [propostas, setPropostas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [acessosRes, propostasRes] = await Promise.all([
        supabase.from('proposta_acessos').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('propostas').select('id, leads(nome_cliente)').not('senha_acesso', 'is', null),
      ]);

      setAcessos(acessosRes.data ?? []);

      const map: Record<string, string> = {};
      (propostasRes.data ?? []).forEach((p: any) => {
        map[p.id] = p.leads?.nome_cliente || 'Cliente sem nome';
      });
      setPropostas(map);
      setLoading(false);
    }
    load();
  }, []);

  // Group by proposta
  const byProposta: Record<string, Acesso[]> = {};
  acessos.forEach(a => {
    if (!byProposta[a.proposta_id]) byProposta[a.proposta_id] = [];
    byProposta[a.proposta_id].push(a);
  });

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatLocation(a: Acesso) {
    const parts = [a.cidade, a.estado, a.pais].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Local desconhecido';
  }

  function getDevice(ua: string | null) {
    if (!ua) return 'Desconhecido';
    if (/mobile|android|iphone/i.test(ua)) return 'Mobile';
    if (/tablet|ipad/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold-300)', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Acessos às Propostas</h1>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando...</p>
      ) : acessos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          <Eye size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.9rem' }}>Nenhum acesso registrado ainda.</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Os acessos serão registrados quando clientes abrirem propostas publicadas.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {Object.entries(byProposta).map(([propostaId, items]) => (
            <div key={propostaId} className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--gold-100)' }}>
                    {propostas[propostaId] || 'Proposta'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: "var(--font-jetbrains)" }}>
                    {items.length} acesso{items.length > 1 ? 's' : ''}
                  </div>
                </div>
                <a href={`/propostas/editor/${propostaId}`} style={{
                  fontSize: '0.68rem', color: 'var(--gold-300)', textDecoration: 'none',
                  border: '1px solid var(--border-subtle)', padding: '0.3rem 0.7rem',
                  fontFamily: "var(--font-jetbrains)",
                }}>
                  Ver proposta
                </a>
              </div>

              {/* Access list */}
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {items.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 0.8rem',
                    background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.78rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gold-300)', minWidth: '180px' }}>
                      <MapPin size={13} style={{ opacity: 0.6 }} />
                      <span>{formatLocation(a)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-dim)', minWidth: '160px' }}>
                      <Clock size={13} style={{ opacity: 0.6 }} />
                      <span>{formatDate(a.created_at)}</span>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                      {getDevice(a.user_agent)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
