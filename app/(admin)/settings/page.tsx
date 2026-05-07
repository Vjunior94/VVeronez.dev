'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, Loader2 } from 'lucide-react';

interface ConfigSection {
  titulo: string;
  campos: { chave: string; label: string; tipo: 'text' | 'toggle' | 'number' | 'select' | 'array'; opcoes?: string[] }[];
}

const SECTIONS: ConfigSection[] = [
  {
    titulo: 'Notificações',
    campos: [
      { chave: 'notificacoes_modo', label: 'Modo', tipo: 'select', opcoes: ['imediata', 'mista', 'pausada'] },
      { chave: 'notificacoes_horario_inicio', label: 'Horário início', tipo: 'text' },
      { chave: 'notificacoes_horario_fim', label: 'Horário fim', tipo: 'text' },
      { chave: 'valmir_whatsapp_pessoal', label: 'WhatsApp Valmir', tipo: 'text' },
      { chave: 'dashboard_url_publica', label: 'URL Dashboard', tipo: 'text' },
    ],
  },
  {
    titulo: 'Follow-up Automático',
    campos: [
      { chave: 'followup_ativo', label: 'Follow-up ativo', tipo: 'toggle' },
      { chave: 'followup_max_tentativas', label: 'Max tentativas', tipo: 'number' },
    ],
  },
  {
    titulo: 'Sofia (Agente)',
    campos: [
      { chave: 'agente_pausado', label: 'Agente pausado', tipo: 'toggle' },
      { chave: 'agente_modelo_claude', label: 'Modelo Claude', tipo: 'text' },
    ],
  },
];

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || '');
        setCreatedAt(new Date(user.created_at).toLocaleDateString('pt-BR'));
      }
    });

    fetch('/api/configuracoes')
      .then(r => r.json())
      .then(data => {
        setConfigs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (chave: string, valor: any) => {
    setConfigs(prev => ({ ...prev, [chave]: valor }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    color: 'var(--text-primary, #eee)', fontSize: '0.85rem',
    fontFamily: 'var(--font-jetbrains)', borderRadius: '4px', outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Configurações</h1>
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: saved ? 'rgba(95,208,184,0.15)' : 'rgba(212,160,74,0.1)',
          border: `1px solid ${saved ? 'rgba(95,208,184,0.3)' : 'rgba(212,160,74,0.25)'}`,
          color: saved ? '#5fd0b8' : 'var(--gold-300)',
          padding: '0.5rem 1rem', fontSize: '0.75rem', cursor: 'pointer',
          fontFamily: 'var(--font-jetbrains)', letterSpacing: '0.05em',
        }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Conta */}
      <div className="dash-card" style={{ maxWidth: '600px', marginBottom: '1.5rem', padding: '1.2rem 1.5rem' }}>
        <div className="dash-card-label">Conta</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Email</div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{email}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Membro desde</div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{createdAt}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Carregando configurações...</p>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
          {SECTIONS.map(section => (
            <div key={section.titulo} className="dash-card" style={{ padding: '1.2rem 1.5rem' }}>
              <div className="dash-card-label">{section.titulo}</div>
              <div style={{ display: 'grid', gap: '1rem', marginTop: '0.8rem' }}>
                {section.campos.map(campo => {
                  const val = configs[campo.chave];
                  return (
                    <div key={campo.chave}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.3rem', fontFamily: 'var(--font-jetbrains)' }}>
                        {campo.label} <span style={{ opacity: 0.5 }}>({campo.chave})</span>
                      </div>
                      {campo.tipo === 'toggle' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={val === true || val === 'true'}
                            onChange={e => handleChange(campo.chave, e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#5fd0b8' }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {val === true || val === 'true' ? 'Ativo' : 'Inativo'}
                          </span>
                        </label>
                      ) : campo.tipo === 'select' ? (
                        <select
                          value={val || ''}
                          onChange={e => handleChange(campo.chave, e.target.value)}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          <option value="">—</option>
                          {campo.opcoes?.map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                      ) : campo.tipo === 'number' ? (
                        <input
                          type="number"
                          value={val ?? ''}
                          onChange={e => handleChange(campo.chave, Number(e.target.value))}
                          style={inputStyle}
                        />
                      ) : (
                        <input
                          type="text"
                          value={val ?? ''}
                          onChange={e => handleChange(campo.chave, e.target.value)}
                          style={inputStyle}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
