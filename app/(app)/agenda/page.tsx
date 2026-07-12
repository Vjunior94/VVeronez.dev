'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, CalendarDays, Clock } from 'lucide-react';
import {
  carregarContexto, listarCompromissos, criarCompromisso, atualizarCompromisso, removerCompromisso,
  validarForm, type Compromisso, type ContextoAgenda, type FormInput,
} from '@/lib/agenda-data';
import { formatarInstanteSP, partesInstanteSP } from '@/lib/tempo';
import { proximaOcorrencia, descreverRegra } from '@/lib/ocorrencia';

const DIAS = [{ n: 0, l: 'D' }, { n: 1, l: 'S' }, { n: 2, l: 'T' }, { n: 3, l: 'Q' }, { n: 4, l: 'Q' }, { n: 5, l: 'S' }, { n: 6, l: 'S' }];

function vazio(usuarioId: string): FormInput {
  return {
    usuario_id: usuarioId, titulo: '', data: '', hora: '', recorrencia: 'nenhuma',
    dias_semana: [], dia_mes: 1, antecedencia_min: 30, descricao: '',
  };
}

export default function AgendaPage() {
  const [ctx, setCtx] = useState<ContextoAgenda | null>(null);
  const [escopo, setEscopo] = useState<string>('todos'); // usuario_id filtro (admin) ou o próprio
  const [itens, setItens] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async (esc: string) => {
    setLoading(true);
    setItens(await listarCompromissos(esc as string | 'todos'));
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarContexto().then((c) => {
      setCtx(c);
      const esc = c.isAdmin ? 'todos' : (c.meuUsuarioId ?? 'todos');
      setEscopo(esc);
      recarregar(esc);
    });
  }, [recarregar]);

  const nomeDoUsuario = (id: string) => ctx?.usuarios.find((u) => u.id === id)?.nome ?? '';

  const abrirNovo = () => {
    const dono = ctx?.isAdmin ? (escopo !== 'todos' ? escopo : (ctx.usuarios[0]?.id ?? '')) : (ctx?.meuUsuarioId ?? '');
    setForm(vazio(dono)); setEditId(null); setErro('');
  };

  const abrirEdicao = (c: Compromisso) => {
    // Único guarda data+hora em inicio_em; recorrente guarda só hora_base ("HH:MM:SS").
    const { data, hora } = c.inicio_em
      ? partesInstanteSP(c.inicio_em)
      : { data: '', hora: (c.hora_base ?? '').slice(0, 5) };
    setForm({
      usuario_id: c.usuario_id, titulo: c.titulo, data, hora,
      recorrencia: c.recorrencia, dias_semana: c.dias_semana ?? [], dia_mes: c.dia_mes ?? 1,
      antecedencia_min: c.antecedencia_min, descricao: c.descricao ?? '',
    });
    setEditId(c.id); setErro('');
  };

  const salvar = async () => {
    if (!form) return;
    const problema = validarForm(form);
    if (problema) { setErro(problema); return; }
    const r = editId ? await atualizarCompromisso(editId, form) : await criarCompromisso(form);
    if (r.error) { setErro(r.error); return; }
    setForm(null); setEditId(null);
    recarregar(escopo);
  };

  const remover = async (id: string) => {
    if (!confirm('Remover este compromisso?')) return;
    await removerCompromisso(id);
    recarregar(escopo);
  };

  const trocarEscopo = (esc: string) => { setEscopo(esc); recarregar(esc); };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Agenda</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {ctx?.isAdmin && (
            <select value={escopo} onChange={(e) => trocarEscopo(e.target.value)}
              style={{ padding: '0.45rem 0.7rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)', fontFamily: 'inherit', fontSize: '0.8rem' }}>
              <option value="todos">Todos</option>
              {ctx.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
          <button onClick={abrirNovo} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--gold-300)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'var(--font-jetbrains)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      {form && (
        <div className="dash-card" style={{ padding: '1.2rem', marginBottom: '1.2rem', display: 'grid', gap: '0.7rem' }}>
          {erro && <div className="login-error">{erro}</div>}
          {ctx?.isAdmin && (
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Para
              <select value={form.usuario_id} onChange={(e) => setForm({ ...form, usuario_id: e.target.value })}
                style={{ padding: '0.45rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }}>
                {ctx.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </label>
          )}
          <input placeholder="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
          <input placeholder="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
          {/* A recorrência é a PRIMEIRA pergunta: ela decide quais campos aparecem. */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Repetição
              <select value={form.recorrencia}
                onChange={(e) => setForm({ ...form, recorrencia: e.target.value as FormInput['recorrencia'] })}
                style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }}>
                <option value="nenhuma">Única (tem data)</option>
                <option value="diaria">Todo dia</option>
                <option value="semanal">Toda semana</option>
                <option value="mensal">Todo mês</option>
              </select>
            </label>

            {form.recorrencia === 'nenhuma' && (
              <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Data
                <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })}
                  style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
              </label>
            )}

            {form.recorrencia === 'mensal' && (
              <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Dia do mês
                <input type="number" min={1} max={31} value={form.dia_mes}
                  onChange={(e) => setForm({ ...form, dia_mes: Number(e.target.value) })}
                  style={{ width: 72, padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
              </label>
            )}

            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>Hora
              <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })}
                style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              lembrar <input type="number" value={form.antecedencia_min} min={0}
                onChange={(e) => setForm({ ...form, antecedencia_min: Number(e.target.value) })}
                style={{ width: 64, padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--gold-100)' }} /> min antes
            </label>
          </div>

          {form.recorrencia === 'semanal' && (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {DIAS.map((d) => {
                const on = form.dias_semana.includes(d.n);
                return <button key={d.n} type="button" onClick={() => setForm({ ...form, dias_semana: on ? form.dias_semana.filter((x) => x !== d.n) : [...form.dias_semana, d.n] })}
                  style={{ width: 34, height: 34, cursor: 'pointer', background: on ? 'rgba(184,130,107,0.2)' : 'none', border: '1px solid var(--border-subtle)', color: on ? 'var(--gold-300)' : 'var(--text-dim)' }}>{d.l}</button>;
              })}
            </div>
          )}

          {form.recorrencia === 'mensal' && form.dia_mes > 28 && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              Em meses sem o dia {form.dia_mes}, o lembrete cai no último dia do mês.
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={salvar} className="login-submit" style={{ width: 'auto', padding: '0.5rem 1.2rem' }}>{editId ? 'Salvar' : 'Criar'}</button>
            <button onClick={() => { setForm(null); setEditId(null); }} style={{ padding: '0.5rem 1.2rem', background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--text-dim)' }}>Carregando...</p>
        : itens.length === 0 ? <p style={{ color: 'var(--text-dim)' }}>Nenhum compromisso.</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {itens
            .map((c) => ({ c, occ: proximaOcorrencia(c, new Date()) }))
            // Ordena pela PRÓXIMA ocorrência. Sem ocorrência (único já passado) vai pro fim.
            .sort((a, b) => (a.occ?.getTime() ?? Infinity) - (b.occ?.getTime() ?? Infinity))
            .map(({ c, occ }) => (
            <div key={c.id} className="dash-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.3rem' }}>
              <CalendarDays size={18} style={{ color: 'var(--gold-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--gold-100)', fontSize: '0.9rem' }}>{c.titulo}</div>
                <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.72rem', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                  <span>{occ ? formatarInstanteSP(occ.toISOString()) : 'já passou'}</span>
                  {c.recorrencia !== 'nenhuma' && <span>{descreverRegra(c)}</span>}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={11} /> {c.antecedencia_min}min</span>
                  {ctx?.isAdmin && escopo === 'todos' && <span>· {nomeDoUsuario(c.usuario_id)}</span>}
                </div>
              </div>
              <button onClick={() => abrirEdicao(c)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} aria-label="Editar"><Pencil size={15} /></button>
              <button onClick={() => remover(c.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }} aria-label="Remover"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>}
    </>
  );
}
