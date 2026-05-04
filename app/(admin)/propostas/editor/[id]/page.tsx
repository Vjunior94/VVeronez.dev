'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Save, Globe, Copy, Send, Loader2, Image, X, Trash2, PanelLeftClose, PanelLeftOpen, DollarSign, Clock, LayoutGrid, Check, Minus } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

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

interface ConteudoPagina {
  hero_titulo: string;
  hero_subtitulo: string;
  hero_media_url: string;
  hero_media_type: 'image' | 'video' | 'gif';
  problema_titulo: string;
  problema_texto: string;
  solucao_titulo: string;
  solucao_texto: string;
  modulos: { nome: string; descricao: string; horas: number; fase: string }[];
  stack: string[];
  cronograma: { fase: string; descricao: string; semanas: number; entregaveis: string[] }[];
  investimento_total: string;
  investimento_nota: string;
  servicos: { nome: string; custo: string }[];
  riscos: string;
  cta_titulo: string;
  cta_texto: string;
  senha_acesso: string;
  validade_dias: number;
  resumo_executivo?: ResumoExecutivo;
  tema?: Tema;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Persistence helpers ─────────────────────────────────────────────

function loadChatLocal(id: string): Message[] {
  try { return JSON.parse(localStorage.getItem(`agenor-editor:${id}`) || '[]'); } catch { return []; }
}
function saveChatLocal(id: string, msgs: Message[]) {
  try { localStorage.setItem(`agenor-editor:${id}`, JSON.stringify(msgs)); } catch {}
}

let dbTimer: ReturnType<typeof setTimeout> | null = null;
function saveChatDB(id: string, msgs: Message[]) {
  if (dbTimer) clearTimeout(dbTimer);
  dbTimer = setTimeout(async () => {
    const supabase = createClient();
    await supabase.from('propostas').update({ agenor_chat: msgs }).eq('id', id);
  }, 2000);
}

function persistChat(id: string, msgs: Message[]) {
  saveChatLocal(id, msgs);
  saveChatDB(id, msgs);
}

// ─── Preview helpers (from public page) ──────────────────────────────

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
          display: 'flex', gap: '0.6rem', marginBottom: '0.5rem', padding: '0.7rem 0.8rem',
          background: 'rgba(255,255,255,0.025)', borderRadius: '8px',
          borderLeft: '2px solid var(--bronze)',
        }}>
          <span style={{ color: 'var(--bronze2)', fontFamily: "'Cinzel',Georgia,serif", fontWeight: 700, fontSize: '0.95em', flexShrink: 0, lineHeight: 1.5 }}>{num}.</span>
          <span style={{ lineHeight: 1.6 }}>{content}</span>
        </div>
      );
    }
    if (isList) {
      return (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ color: 'var(--bronze)', flexShrink: 0 }}>◆</span>
          <span>{rendered.map((r) => typeof r === 'string' ? r.replace(/^-\s*/, '') : r)}</span>
        </div>
      );
    }
    return line.trim() ? <p key={i} style={{ marginBottom: '0.3rem' }}>{rendered}</p> : <br key={i} />;
  });
}

// ─── Chat markdown renderer ─────────────────────────────────────────

function renderChat(text: string) {
  // Hide JSON blocks from display
  const cleaned = text.replace(/```json:proposta_editada[\s\S]*?```/g, '').trim();
  if (!cleaned) return [<p key={0} style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>JSON atualizado com sucesso.</p>];
  return cleaned.split('\n').map((line, i) => {
    let rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:0.1rem 0.3rem;font-size:0.82em">$1</code>');
    if (line.startsWith('# ')) return <h3 key={i} style={{ fontSize: '1rem', color: 'var(--gold-100)', fontFamily: "var(--font-cinzel)", margin: '0.6rem 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} />;
    if (line.startsWith('## ')) return <h4 key={i} style={{ fontSize: '0.9rem', color: 'var(--gold-100)', margin: '0.4rem 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: rendered.slice(3) }} />;
    if (line.match(/^- /)) return <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.1rem' }}><span style={{ color: 'var(--gold-500)' }}>◆</span><span dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} /></div>;
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} style={{ marginBottom: '0.1rem' }} dangerouslySetInnerHTML={{ __html: rendered }} />;
  });
}

// ─── Main Page ───────────────────────────────────────────────────────

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PropostaEditorPage() {
  const params = useParams();
  const router = useRouter();
  const propostaId = params.id as string;

  // Core state
  const [conteudo, setConteudo] = useState<ConteudoPagina | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Sync ref + persist
  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length > 0) persistChat(propostaId, messages);
  }, [messages, propostaId]);

  // Load data
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: proposta } = await supabase
        .from('propostas')
        .select('*, leads(nome_cliente)')
        .eq('id', propostaId)
        .single();

      if (!proposta) { setLoading(false); return; }

      const nome = (proposta.leads as any)?.nome_cliente || 'Cliente';
      setClienteNome(nome);

      // Load chat from localStorage, fallback to Supabase
      let chat = loadChatLocal(propostaId);
      if (chat.length === 0 && proposta.agenor_chat && Array.isArray(proposta.agenor_chat)) {
        chat = proposta.agenor_chat;
        saveChatLocal(propostaId, chat);
      }
      setMessages(chat);

      if (proposta.conteudo_pagina) {
        setConteudo(proposta.conteudo_pagina);
        if (proposta.senha_acesso) {
          setPublishedUrl(`${window.location.origin}/proposta/${propostaId}`);
        }
      } else {
        const [modsRes, servsRes] = await Promise.all([
          supabase.from('proposta_modulos').select('*').eq('proposta_id', propostaId).order('ordem'),
          supabase.from('proposta_servicos').select('*').eq('proposta_id', propostaId),
        ]);
        const mods = modsRes.data ?? [];
        const servs = servsRes.data ?? [];
        const stackObj = proposta.stack_recomendada || {};
        const stackArr = Object.values(stackObj).filter(Boolean) as string[];

        setConteudo({
          hero_titulo: `Proposta para\n${nome}`,
          hero_subtitulo: proposta.resumo || '',
          hero_media_url: '',
          hero_media_type: 'image',
          problema_titulo: 'O problema que vamos resolver',
          problema_texto: '',
          solucao_titulo: 'A solucao proposta',
          solucao_texto: proposta.resumo || '',
          modulos: mods.map(m => ({ nome: m.nome, descricao: m.descricao, horas: m.horas_estimadas, fase: m.fase })),
          stack: stackArr.length ? stackArr : ['Next.js', 'React', 'TypeScript', 'Supabase', 'Tailwind CSS'],
          cronograma: proposta.cronograma || [],
          investimento_total: formatBRL(proposta.custo_total_centavos),
          investimento_nota: proposta.observacoes || '',
          servicos: servs.map(s => ({ nome: s.nome, custo: formatBRL(s.custo_mensal_centavos) + '/mes' })),
          riscos: proposta.riscos || '',
          cta_titulo: 'Pronto para\ncomecar?',
          cta_texto: 'Vamos marcar uma conversa para alinhar os detalhes e dar o primeiro passo.',
          senha_acesso: proposta.senha_acesso || '',
          validade_dias: 15,
        });
      }
      setLoading(false);
    }
    load();
  }, [propostaId]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // ─── Save / Publish ────────────────────────────────────────────────

  const handleSave = async () => {
    if (!conteudo) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('propostas').update({
      conteudo_pagina: conteudo,
      hero_media_url: conteudo.hero_media_url || null,
      senha_acesso: conteudo.senha_acesso || null,
    }).eq('id', propostaId);

    if (conteudo.senha_acesso) {
      setPublishedUrl(`${window.location.origin}/proposta/${propostaId}`);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `propostas/${propostaId}/hero.${ext}`;
    const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true });
    if (error) {
      await supabase.storage.createBucket('public-assets', { public: true });
      await supabase.storage.from('public-assets').upload(path, file, { upsert: true });
    }
    const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(path);
    const mediaType = file.type.startsWith('video') ? 'video' : file.type === 'image/gif' ? 'gif' : 'image';
    setConteudo(prev => prev ? { ...prev, hero_media_url: urlData.publicUrl, hero_media_type: mediaType } : prev);
  };

  // ─── Chat + Streaming ─────────────────────────────────────────────

  const streamEdit = useCallback(async (msgs: Message[]) => {
    if (!conteudo) return;
    setStreaming(true);

    const withPlaceholder = [...msgs, { role: 'assistant' as const, content: '' }];
    setMessages(withPlaceholder);

    try {
      const res = await fetch('/api/agenor/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, conteudoPagina: conteudo }),
      });

      if (!res.ok) {
        const errMsgs = [...msgs, { role: 'assistant' as const, content: 'Erro ao conectar com o Agenor. Tente novamente.' }];
        setMessages(errMsgs);
        persistChat(propostaId, errMsgs);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setStreaming(false); return; }

      let fullText = '';
      let buffer = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const { text } = JSON.parse(data);
              fullText += text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullText };
                return updated;
              });
            } catch {}
          }
        }
      }

      const finalMsgs = [...msgs, { role: 'assistant' as const, content: fullText }];
      setMessages(finalMsgs);
      persistChat(propostaId, finalMsgs);

      // Parse JSON from response and update preview
      const jsonMatch = fullText.match(/```json:proposta_editada\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          setConteudo(parsed);
          // Auto-save to Supabase
          const supabase = createClient();
          await supabase.from('propostas').update({ conteudo_pagina: parsed }).eq('id', propostaId);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } catch (e) { console.error('Parse error:', e); }
      }
    } catch (e) {
      console.error('Stream error:', e);
      const current = messagesRef.current;
      if (current.length > 0 && current[current.length - 1].role === 'assistant' && !current[current.length - 1].content) {
        const fixed = [...current.slice(0, -1), { role: 'assistant' as const, content: 'Conexao perdida. Envie novamente.' }];
        setMessages(fixed);
        persistChat(propostaId, fixed);
      }
    } finally {
      setStreaming(false);
    }
  }, [conteudo, propostaId]);

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    const newMsg: Message = { role: 'user', content: input.trim() };
    const allMsgs = [...messages, newMsg];
    setMessages(allMsgs);
    persistChat(propostaId, allMsgs);
    setInput('');
    streamEdit(allMsgs);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClearChat = () => {
    if (!confirm('Limpar conversa? O conteudo da proposta sera mantido.')) return;
    localStorage.removeItem(`agenor-editor:${propostaId}`);
    setMessages([]);
  };

  // ─── Loading / Error ───────────────────────────────────────────────

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>Carregando editor...</p>;
  if (!conteudo) return <p style={{ color: 'var(--text-dim)' }}>Proposta nao encontrada.</p>;

  // ─── Preview data ──────────────────────────────────────────────────

  const c = conteudo;
  const tema = (c.tema || {}) as Tema;
  const previewTemaVars = [
    tema.cor_primaria && `--bronze: ${tema.cor_primaria}`,
    tema.cor_fundo && `--bg: ${tema.cor_fundo}`,
    tema.cor_fundo_card && `--bg2: ${tema.cor_fundo_card}`,
    tema.cor_texto && `--text: ${tema.cor_texto}`,
    tema.cor_accent && `--bronze2: ${tema.cor_accent}`,
    tema.cor_muted && `--muted: ${tema.cor_muted}`,
  ].filter(Boolean).join('; ');
  const displayModulos = c.modulos || [];
  const fases = ['mvp', 'v1', 'v2'];
  const modulosByFase = fases.map(f => ({ fase: f, mods: displayModulos.filter(m => m.fase === f) })).filter(g => g.mods.length > 0);
  const displayCrono = c.cronograma || [];
  const totalSemanas = displayCrono.reduce((acc, f) => acc + f.semanas, 0);
  const totalHoras = displayModulos.reduce((a, m) => a + (m.horas || 0), 0);
  const maxModHoras = Math.max(...displayModulos.map(m => m.horas || 0), 1);
  const displayStack = c.stack || [];
  const displayServicos = c.servicos || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem', flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold-300)', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="admin-page-title" style={{ marginBottom: '0.1rem', fontSize: '1.1rem' }}>
            Editor de Proposta
          </h1>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            {clienteNome} {saved && <span style={{ color: '#5fd0b8' }}> · Salvo!</span>}
          </span>
        </div>

        {/* Upload media */}
        <button onClick={() => fileInputRef.current?.click()} style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none',
          border: '1px solid var(--border-subtle)', color: 'var(--gold-300)',
          padding: '0.4rem 0.7rem', fontSize: '0.68rem', cursor: 'pointer',
          fontFamily: "var(--font-jetbrains)",
        }}>
          <Image size={12} /> Midia
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleImageUpload} style={{ display: 'none' }} />

        {/* Toggle chat */}
        <button onClick={() => setChatCollapsed(!chatCollapsed)} style={{
          display: 'flex', alignItems: 'center', background: 'none',
          border: '1px solid var(--border-subtle)', color: 'var(--gold-300)',
          padding: '0.4rem', cursor: 'pointer',
        }} title={chatCollapsed ? 'Abrir chat' : 'Fechar chat'}>
          {chatCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {/* Save */}
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 1rem',
          background: 'linear-gradient(135deg, rgba(212,160,74,0.2), rgba(184,130,107,0.2))',
          border: '1px solid rgba(212,160,74,0.4)', color: 'var(--gold-100)',
          fontSize: '0.72rem', cursor: 'pointer', fontFamily: "var(--font-jetbrains)",
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          Salvar
        </button>

        {/* Copy link */}
        {publishedUrl && (
          <button onClick={() => navigator.clipboard.writeText(publishedUrl!)} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none',
            border: '1px solid rgba(95,208,184,0.25)', color: '#5fd0b8',
            padding: '0.4rem 0.7rem', fontSize: '0.68rem', cursor: 'pointer',
            fontFamily: "var(--font-jetbrains)",
          }}>
            <Copy size={12} /> Link
          </button>
        )}

        {/* Preview link */}
        {publishedUrl && (
          <a href={publishedUrl} target="_blank" rel="noopener" style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            background: 'rgba(95,208,184,0.1)', border: '1px solid rgba(95,208,184,0.25)',
            color: '#5fd0b8', padding: '0.4rem 0.7rem', fontSize: '0.68rem',
            textDecoration: 'none', fontFamily: "var(--font-jetbrains)",
          }}>
            <Globe size={12} /> Abrir
          </a>
        )}
      </div>

      {/* ═══ MAIN SPLIT ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: chatCollapsed ? '1fr' : '380px 1fr',
        gap: '0.8rem',
        flex: 1,
        minHeight: 0,
      }}>

        {/* ═══ LEFT: CHAT ═══ */}
        {!chatCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Chat header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.5rem 0.8rem', background: 'rgba(10,8,20,0.6)', border: '1px solid var(--border-subtle)',
              borderBottom: 'none', fontSize: '0.7rem',
            }}>
              <span style={{ color: 'var(--gold-300)', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Agenor · Editor
              </span>
              {messages.length > 0 && (
                <button onClick={handleClearChat} title="Limpar conversa" style={{
                  display: 'flex', alignItems: 'center', background: 'none',
                  border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.2rem',
                }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* Chat messages */}
            <div ref={chatRef} style={{
              flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem',
              padding: '0.8rem', background: 'rgba(10,8,20,0.4)', border: '1px solid var(--border-subtle)',
              borderBottom: 'none',
            }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.3 }}>◆</div>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Diga ao Agenor o que quer mudar.<br />
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      Ex: &ldquo;mude o titulo&rdquo;, &ldquo;adicione um modulo de chat&rdquo;, &ldquo;troque a stack&rdquo;
                    </span>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: msg.role === 'user' ? '85%' : '95%',
                  padding: '0.6rem 0.8rem',
                  background: msg.role === 'user' ? 'rgba(184, 130, 107, 0.12)' : 'rgba(20, 16, 30, 0.8)',
                  border: msg.role !== 'user' ? '1px solid var(--border-subtle)' : 'none',
                  borderRadius: '6px', fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-primary)',
                }}>
                  <div style={{
                    fontSize: '0.55rem', color: msg.role === 'user' ? 'var(--gold-300)' : 'var(--text-dim)',
                    marginBottom: '0.2rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {msg.role === 'user' ? 'Valmir' : 'Agenor'}
                  </div>
                  <div>{msg.role === 'user' ? msg.content : renderChat(msg.content)}</div>
                </div>
              ))}
              {streaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', padding: '0.3rem' }}>
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} /> Agenor esta editando...
                </div>
              )}
            </div>

            {/* Chat input */}
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              <textarea
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ex: mude o titulo para..."
                rows={2}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                  color: 'var(--gold-100)', padding: '0.6rem 0.8rem', fontSize: '0.82rem',
                  fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.4,
                }}
              />
              <button onClick={handleSend} disabled={streaming || !input.trim()} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '42px', background: 'rgba(212,160,74,0.15)',
                border: '1px solid rgba(212,160,74,0.3)', color: 'var(--gold-100)',
                cursor: streaming ? 'wait' : 'pointer', flexShrink: 0,
              }}>
                <Send size={16} />
              </button>
            </div>

            {/* Publish bar */}
            <div style={{
              marginTop: '0.5rem', padding: '0.6rem 0.8rem',
              background: 'rgba(95,208,184,0.04)', border: '1px solid rgba(95,208,184,0.15)',
              display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.72rem',
            }}>
              <input
                value={conteudo.senha_acesso}
                onChange={e => setConteudo(prev => prev ? { ...prev, senha_acesso: e.target.value } : prev)}
                placeholder="Senha do cliente"
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
                  color: 'var(--gold-100)', padding: '0.35rem 0.6rem', fontSize: '0.72rem',
                  fontFamily: "var(--font-jetbrains)", outline: 'none',
                }}
              />
              <button onClick={handleSave} disabled={saving || !conteudo.senha_acesso} style={{
                padding: '0.35rem 0.8rem',
                background: conteudo.senha_acesso ? 'rgba(95,208,184,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${conteudo.senha_acesso ? 'rgba(95,208,184,0.3)' : 'var(--border-subtle)'}`,
                color: conteudo.senha_acesso ? '#5fd0b8' : 'var(--text-dim)',
                fontSize: '0.68rem', fontFamily: "var(--font-jetbrains)",
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: conteudo.senha_acesso ? 'pointer' : 'default',
              }}>
                <Globe size={11} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                Publicar
              </button>
            </div>
          </div>
        )}

        {/* ═══ RIGHT: PREVIEW ═══ */}
        <div ref={previewRef} style={{
          overflowY: 'auto', background: '#09080f', border: '1px solid var(--border-subtle)',
          position: 'relative',
        }}>
          <style>{previewCSS}</style>
          {previewTemaVars && <style>{`.prop-page { ${previewTemaVars}; }`}</style>}
          <div className="prop-page">
            {/* Nav */}
            <div style={{
              position: 'sticky', top: 0, padding: '0.8rem 1.5rem', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(9,8,15,0.9)', backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255,255,255,0.07)', zIndex: 10,
            }}>
              <span className="nav-logo">VV<span>eronez</span>.dev</span>
              <span className="nav-tag">Proposta Tecnica</span>
            </div>

            {/* Hero */}
            <div className="prop-hero">
              <div className="hero-glow" />
              <div className="hero-glow-2" />
              <div className="prop-hero-inner" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="hero-eyebrow">
                    <div className="hero-eyebrow-line" />
                    <div className="hero-eyebrow-text">Proposta tecnica · {new Date().getFullYear()}</div>
                  </div>
                  <h1 className="hero-title" style={{ fontSize: 'clamp(28px,4vw,48px)' }}>
                    {c.hero_titulo.split('\n').map((line, i) => (
                      <span key={i}>{i === c.hero_titulo.split('\n').length - 1 ? <em>{line}</em> : <>{line}<br /></>}</span>
                    ))}
                  </h1>
                  {c.hero_subtitulo && <div className="hero-sub">{renderMd(c.hero_subtitulo)}</div>}
                  <div className="hero-meta">
                    <div className="hero-meta-item">
                      <div className="hero-meta-label">Prazo estimado</div>
                      <div className="hero-meta-value">{totalSemanas} semanas</div>
                    </div>
                    <div className="hero-meta-item">
                      <div className="hero-meta-label">Modulos</div>
                      <div className="hero-meta-value">{displayModulos.length}</div>
                    </div>
                    {c.validade_dias > 0 && (
                      <div className="hero-meta-item">
                        <div className="hero-meta-label">Validade</div>
                        <div className="hero-meta-value">{c.validade_dias} dias</div>
                      </div>
                    )}
                  </div>
                </div>
                {c.hero_media_url && (
                  <div className="hero-media">
                    {c.hero_media_type === 'video' ? (
                      <video src={c.hero_media_url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                    ) : (
                      <img src={c.hero_media_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Resumo Executivo */}
            {c.resumo_executivo && (() => {
              const re = c.resumo_executivo!;
              return (
                <section className="re-section">
                  <div className="re-ident">
                    <div className="re-ident-label">Proposta para</div>
                    <div className="re-name">{re.saudacao}</div>
                    <div className="re-type">{re.tipo_projeto}</div>
                  </div>
                  <div className="re-understand">
                    <div className="re-understand-label">O que entendemos do seu projeto</div>
                    <p className="re-understand-text">{re.entendimento_do_cliente}</p>
                  </div>
                  <div className="re-oneliner">
                    <div className="re-oneliner-label">O que voce vai ter</div>
                    <div className="re-oneliner-text">{re.entrega_em_uma_frase}</div>
                  </div>
                  <div className="re-cards">
                    <div className="re-card">
                      <DollarSign size={16} className="re-card-icon" />
                      <div className="re-card-label">Investimento</div>
                      <div className="re-card-value">{re.numeros_chave.investimento.valor_total}</div>
                      <div className="re-card-detail">{re.numeros_chave.investimento.forma_pagamento_resumida}</div>
                      {re.numeros_chave.investimento.valor_mensal_recorrente && (
                        <div className="re-card-pill">+ {re.numeros_chave.investimento.valor_mensal_recorrente} recorrente</div>
                      )}
                    </div>
                    <div className="re-card">
                      <Clock size={16} className="re-card-icon" />
                      <div className="re-card-label">Prazo</div>
                      <div className="re-card-value">{re.numeros_chave.prazo.duracao}</div>
                      <div className="re-card-detail">{re.numeros_chave.prazo.data_estimada_entrega}</div>
                    </div>
                    <div className="re-card">
                      <LayoutGrid size={16} className="re-card-icon" />
                      <div className="re-card-label">Escopo</div>
                      <div className="re-card-value">{re.numeros_chave.escopo_resumido.destaque_numerico}</div>
                      <div className="re-card-detail">{re.numeros_chave.escopo_resumido.complemento}</div>
                    </div>
                  </div>
                  <div className="re-list-section">
                    <div className="re-list-title">O que esta incluso</div>
                    <div className="re-list">
                      {re.o_que_voce_recebe.map((item, i) => (
                        <div key={i} className="re-list-item re-list-item--check">
                          <Check size={14} className="re-icon-check" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="re-list-section">
                    <div className="re-list-title">O que nao esta incluso</div>
                    <div className="re-list">
                      {re.o_que_nao_esta_incluso.map((item, i) => (
                        <div key={i} className="re-list-item re-list-item--exclude">
                          <Minus size={12} className="re-icon-minus" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="re-list-note">Esses itens podem ser orcados separadamente.</div>
                  </div>
                  <div className="re-action">
                    <p className="re-action-text">{re.proximo_passo.texto}</p>
                    <span className="re-action-btn">
                      {re.proximo_passo.tipo_acao === 'whatsapp' ? 'Chamar no WhatsApp →' : re.proximo_passo.tipo_acao === 'email' ? 'Enviar e-mail →' : 'Aceitar proposta →'}
                    </span>
                  </div>
                  <div className="re-divider">
                    <div className="re-divider-line" />
                    <div className="re-divider-center">
                      <span className="re-divider-label">Detalhes da proposta</span>
                      <span className="re-divider-sub">Para conhecer cada parte do projeto a fundo</span>
                    </div>
                    <div className="re-divider-line" />
                  </div>
                </section>
              );
            })()}

            {/* Contexto */}
            {c.problema_texto && (
              <section className="prop-section">
                <div className="section-tag">01 — Contexto</div>
                <h2 className="section-title">O problema que<br />vamos resolver</h2>
                <p className="section-subtitle">Entendemos sua situacao atual e propomos uma solucao sob medida.</p>
                <div className="context-grid">
                  <div className="context-card context-problem">
                    <div className="context-icon">⚠</div>
                    <div className="context-label problem-label">O cenario atual</div>
                    <div className="context-card-title">{c.problema_titulo}</div>
                    <div className="context-text">{c.problema_texto}</div>
                  </div>
                  <div className="context-connector">
                    <svg viewBox="0 0 60 20"><path d="M0 10 H45 M40 4 L48 10 L40 16" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </div>
                  <div className="context-card context-solution">
                    <div className="context-icon">◆</div>
                    <div className="context-label solution-label">A transformacao</div>
                    <div className="context-card-title">{c.solucao_titulo}</div>
                    <div className="context-text">{c.solucao_texto}</div>
                  </div>
                </div>
              </section>
            )}

            {/* Modulos */}
            <section className="prop-section">
              <div className="section-tag">{c.problema_texto ? '02' : '01'} — Escopo</div>
              <h2 className="section-title">O que sera<br />construido</h2>
              <p className="section-subtitle">Cada modulo e uma funcionalidade do seu sistema.</p>
              <div className="modules-grid">
                {displayModulos.map((m, i) => (
                  <div key={i} className="module-card">
                    <div className="module-header">
                      <span className="module-icon">{getModuleIcon(m.nome)}</span>
                      <span className="module-num">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="module-name">{m.nome}</div>
                    <div className="module-desc">{m.descricao}</div>
                    <div className="module-footer">
                      <div className="module-bar-wrap">
                        <div className="module-bar" style={{ width: `${(m.horas / maxModHoras) * 100}%` }} />
                      </div>
                      <div className="module-meta">
                        <span>{m.horas}h</span>
                        <span className="module-fase-badge" data-fase={m.fase}>{m.fase.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modules-summary">
                <div className="summary-item"><span className="summary-num">{displayModulos.length}</span><span className="summary-label">modulos</span></div>
                <div className="summary-divider" />
                <div className="summary-item"><span className="summary-num">{totalHoras}h</span><span className="summary-label">de desenvolvimento</span></div>
                <div className="summary-divider" />
                <div className="summary-item"><span className="summary-num">{modulosByFase.length}</span><span className="summary-label">fases</span></div>
              </div>
            </section>

            {/* Stack */}
            {displayStack.length > 0 && (
              <section className="prop-section">
                <div className="section-tag">{c.problema_texto ? '03' : '02'} — Tecnologia</div>
                <h2 className="section-title">Tecnologias<br />utilizadas</h2>
                <div className="stack-grid">
                  {displayStack.map((val, i) => (
                    <div key={i} className="stack-card">
                      <div className="stack-card-name">{val}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cronograma */}
            {displayCrono.length > 0 && (
              <section className="prop-section">
                <div className="section-tag">{c.problema_texto ? '04' : '03'} — Cronograma</div>
                <h2 className="section-title">Etapas do<br />projeto</h2>
                <div className="timeline">
                  {displayCrono.map((fase, i) => (
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
                              {fase.entregaveis.map((e, j) => <span key={j} className="tl-tag">{e}</span>)}
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
            <section className="prop-section">
              <div className="section-tag">Investimento</div>
              <h2 className="section-title">Proposta<br />financeira</h2>
              <div className="invest-card">
                <div className="invest-glow" />
                <div className="invest-price">{c.investimento_total}</div>
                <div className="invest-label">Valor total do desenvolvimento</div>
                <div className="invest-breakdown">
                  <div className="invest-row"><span className="invest-row-label">Horas de desenvolvimento</span><span className="invest-row-value">{totalHoras}h × R$ 50,00</span></div>
                  <div className="invest-row"><span className="invest-row-label">Setup + deploy + infra</span><span className="invest-row-value">R$ 1.000,00</span></div>
                  {displayServicos.map((s, i) => (
                    <div key={i} className="invest-row"><span className="invest-row-label">{s.nome} (mensal)</span><span className="invest-row-value">{s.custo}</span></div>
                  ))}
                </div>
                {c.investimento_nota && <div className="invest-note">{renderMd(c.investimento_nota)}</div>}
                <div className="invest-seal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  <div><strong>Garantia de entrega</strong><br /><span>Codigo-fonte 100% seu. Deploy incluido.</span></div>
                </div>
              </div>
            </section>

            {/* Riscos */}
            {c.riscos && (
              <section className="prop-section">
                <div className="section-tag">Consideracoes</div>
                <h2 className="section-title">Pontos de<br />atencao</h2>
                <div className="risk-card">{renderMd(c.riscos)}</div>
              </section>
            )}

            {/* CTA */}
            <div className="prop-cta">
              <div className="cta-glow" />
              <div className="section-tag" style={{ justifyContent: 'center' }}>Proximos passos</div>
              <h2 className="cta-title">
                {c.cta_titulo.split('\n').map((l, i) => <span key={i}>{l}{i < c.cta_titulo.split('\n').length - 1 && <br />}</span>)}
              </h2>
              <p className="cta-sub">{c.cta_texto}</p>
              <div className="cta-btns">
                <span className="cta-btn-primary">Fechar proposta via WhatsApp →</span>
              </div>
            </div>

            {/* Footer */}
            <div className="prop-footer">
              <span className="footer-logo">VV<span>eronez</span>.dev</span>
              <div className="footer-note">Proposta confidencial · © {new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scoped Preview CSS ──────────────────────────────────────────────
// Exact copy from public page, scoped to .prop-page

const previewCSS = `
.prop-page {
  --bg: #0d0c14; --bg2: #161424; --bg3: #1e1b2e;
  --border: rgba(255,255,255,0.09);
  --bronze: #c8826b; --bronze2: #e0a890; --rose: #c8839a;
  --cream: #f0e6dc; --text: #ddd8d2; --muted: #8a8494;
  background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.7;
}
.prop-page .nav-logo { font-family:'Cinzel',Georgia,serif; font-size:15px; font-weight:700; color:var(--cream); }
.prop-page .nav-logo span { color:var(--bronze); }
.prop-page .nav-tag { font-size:9px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); border:1px solid var(--border); padding:3px 8px; border-radius:100px; }

.prop-page .prop-hero { min-height:50vh; display:flex; align-items:center; padding:4rem 1.5rem 2rem; position:relative; overflow:hidden; }
.prop-page .hero-glow { position:absolute; top:-20%; right:-10%; width:500px; height:500px; background:radial-gradient(ellipse,rgba(200,130,107,.1) 0%,transparent 65%); pointer-events:none; }
.prop-page .hero-glow-2 { position:absolute; bottom:-10%; left:-5%; width:400px; height:300px; background:radial-gradient(ellipse,rgba(200,131,154,.06) 0%,transparent 65%); pointer-events:none; }
.prop-page .prop-hero-inner { max-width:900px; width:100%; position:relative; z-index:1; }
.prop-page .hero-media { flex:0 0 220px; height:260px; border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--bg2); }
.prop-page .hero-eyebrow { display:flex; align-items:center; gap:10px; margin-bottom:1.5rem; }
.prop-page .hero-eyebrow-line { width:30px; height:1px; background:linear-gradient(90deg,var(--bronze),transparent); }
.prop-page .hero-eyebrow-text { font-size:9px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); }
.prop-page .hero-title { font-family:'Cinzel',Georgia,serif; font-weight:700; line-height:0.95; letter-spacing:-0.5px; color:var(--cream); margin-bottom:1rem; }
.prop-page .hero-title em { font-style:italic; color:transparent; -webkit-text-stroke:1px var(--bronze); }
.prop-page .hero-sub { font-size:13px; color:var(--muted); max-width:500px; line-height:1.6; margin-bottom:2rem; }
.prop-page .hero-sub strong { color:var(--text); font-weight:500; }
.prop-page .hero-meta { display:flex; gap:2rem; flex-wrap:wrap; }
.prop-page .hero-meta-label { font-size:9px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); margin-bottom:2px; }
.prop-page .hero-meta-value { font-family:'Cinzel',Georgia,serif; font-size:18px; font-weight:700; color:var(--bronze2); }

.prop-page .prop-section { padding:3rem 1.5rem; max-width:900px; margin:0 auto; border-top:1px solid var(--border); }
.prop-page .section-tag { font-size:9px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); margin-bottom:0.8rem; display:flex; align-items:center; gap:8px; }
.prop-page .section-tag::before { content:''; width:20px; height:1px; background:var(--bronze); }
.prop-page .section-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(22px,3vw,32px); font-weight:600; color:var(--cream); line-height:1.1; margin-bottom:0.6rem; }
.prop-page .section-subtitle { font-size:12px; color:var(--muted); max-width:480px; margin-bottom:2rem; line-height:1.5; }

.prop-page .context-grid { display:grid; grid-template-columns:1fr 40px 1fr; gap:0; align-items:center; margin-top:1.5rem; }
.prop-page .context-card { padding:1.5rem; background:var(--bg2); border:1px solid var(--border); border-radius:12px; position:relative; overflow:hidden; }
.prop-page .context-problem::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#c0504a,transparent); }
.prop-page .context-solution::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--bronze),var(--rose)); }
.prop-page .context-icon { font-size:22px; margin-bottom:0.8rem; }
.prop-page .context-label { font-size:9px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:0.5rem; }
.prop-page .problem-label { color:#c0504a; }
.prop-page .solution-label { color:var(--bronze); }
.prop-page .context-card-title { font-family:'Cinzel',Georgia,serif; font-size:15px; font-weight:600; color:var(--cream); margin-bottom:0.5rem; line-height:1.3; }
.prop-page .context-text { font-size:12px; color:var(--muted); line-height:1.6; }
.prop-page .context-connector { display:flex; align-items:center; justify-content:center; color:var(--bronze); opacity:0.4; }
.prop-page .context-connector svg { width:36px; height:16px; }

.prop-page .modules-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:1px; background:var(--border); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.prop-page .module-card { background:var(--bg2); padding:1.2rem; }
.prop-page .module-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
.prop-page .module-icon { font-size:20px; }
.prop-page .module-num { font-family:'JetBrains Mono',monospace; font-size:9px; color:var(--bronze); opacity:0.5; }
.prop-page .module-name { font-size:13px; font-weight:600; color:var(--cream); margin-bottom:0.3rem; line-height:1.3; }
.prop-page .module-desc { font-size:11px; color:var(--muted); line-height:1.5; margin-bottom:0.6rem; min-height:2em; }
.prop-page .module-footer { margin-top:auto; }
.prop-page .module-bar-wrap { height:2px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; margin-bottom:0.4rem; }
.prop-page .module-bar { height:100%; background:linear-gradient(90deg,var(--bronze),var(--rose)); border-radius:2px; }
.prop-page .module-meta { display:flex; justify-content:space-between; align-items:center; font-size:10px; }
.prop-page .module-meta span:first-child { font-family:'JetBrains Mono',monospace; color:var(--muted); }
.prop-page .module-fase-badge { font-size:9px; font-weight:600; letter-spacing:0.1em; padding:2px 6px; border-radius:5px; }
.prop-page .module-fase-badge[data-fase="mvp"] { color:#5fd0b8; background:rgba(95,208,184,0.12); }
.prop-page .module-fase-badge[data-fase="v1"] { color:var(--bronze2); background:rgba(200,130,107,0.12); }
.prop-page .module-fase-badge[data-fase="v2"] { color:var(--muted); background:rgba(255,255,255,0.05); }

.prop-page .modules-summary { display:flex; align-items:center; justify-content:center; gap:1.5rem; margin-top:1.5rem; padding:0.8rem 0; border:1px solid var(--border); border-radius:10px; background:var(--bg2); }
.prop-page .summary-item { text-align:center; }
.prop-page .summary-num { font-family:'Cinzel',Georgia,serif; font-size:18px; font-weight:700; color:var(--bronze2); display:block; }
.prop-page .summary-label { font-size:10px; color:var(--muted); }
.prop-page .summary-divider { width:1px; height:30px; background:linear-gradient(to bottom,transparent,var(--border),transparent); }

.prop-page .stack-grid { display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:1.5rem; }
.prop-page .stack-card { padding:7px 14px; background:var(--bg2); border:1px solid var(--border); border-radius:8px; }
.prop-page .stack-card-name { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:500; color:var(--text); letter-spacing:0.05em; }

.prop-page .timeline { margin-top:2rem; }
.prop-page .tl-item { display:flex; gap:1rem; position:relative; }
.prop-page .tl-marker { display:flex; flex-direction:column; align-items:center; flex-shrink:0; width:20px; }
.prop-page .tl-dot { width:10px; height:10px; border-radius:50%; border:2px solid var(--bronze); background:var(--bg); flex-shrink:0; position:relative; z-index:1; }
.prop-page .tl-line { width:1px; flex:1; background:linear-gradient(to bottom,var(--bronze) 0%,rgba(200,130,107,0.15) 100%); margin:3px 0; }
.prop-page .tl-content { padding-bottom:2rem; flex:1; }
.prop-page .tl-phase { font-size:9px; font-weight:600; letter-spacing:0.15em; text-transform:uppercase; color:var(--bronze); margin-bottom:3px; }
.prop-page .tl-name { font-size:15px; font-weight:600; color:var(--cream); margin-bottom:0.3rem; }
.prop-page .tl-desc { font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:0.6rem; }
.prop-page .tl-footer { display:flex; flex-wrap:wrap; align-items:center; gap:0.4rem; }
.prop-page .tl-weeks { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--bronze2); padding:3px 8px; background:rgba(200,130,107,0.08); border:1px solid rgba(200,130,107,0.15); border-radius:6px; }
.prop-page .tl-deliverables { display:flex; flex-wrap:wrap; gap:0.2rem; }
.prop-page .tl-tag { font-size:9px; padding:3px 7px; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:5px; color:var(--muted); }

.prop-page .invest-card { margin-top:2rem; padding:2rem; background:var(--bg2); border:1px solid var(--border); border-radius:14px; position:relative; overflow:hidden; }
.prop-page .invest-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--bronze),var(--rose),var(--bronze2)); }
.prop-page .invest-glow { position:absolute; top:-50%; right:-20%; width:300px; height:300px; background:radial-gradient(ellipse,rgba(200,130,107,0.06),transparent 70%); pointer-events:none; }
.prop-page .invest-price { font-family:'Cinzel',Georgia,serif; font-size:clamp(28px,4vw,40px); font-weight:700; color:var(--cream); letter-spacing:-1px; line-height:1; margin-bottom:0.4rem; position:relative; }
.prop-page .invest-label { font-size:11px; color:var(--muted); margin-bottom:1.5rem; }
.prop-page .invest-breakdown { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-bottom:1.5rem; }
.prop-page .invest-row { background:var(--bg3); padding:0.7rem 1rem; display:flex; justify-content:space-between; align-items:center; }
.prop-page .invest-row-label { font-size:11px; color:var(--muted); }
.prop-page .invest-row-value { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--cream); font-weight:500; }
.prop-page .invest-note { font-size:11px; color:var(--muted); padding:1rem; background:rgba(200,130,107,0.05); border:1px solid rgba(200,130,107,0.15); border-radius:10px; line-height:1.6; margin-bottom:1rem; }
.prop-page .invest-note strong { color:var(--cream); font-weight:600; }
.prop-page .invest-seal { display:flex; align-items:center; gap:0.8rem; padding:0.8rem 1rem; background:rgba(95,208,184,0.04); border:1px solid rgba(95,208,184,0.12); border-radius:10px; }
.prop-page .invest-seal svg { width:22px; height:22px; color:#5fd0b8; flex-shrink:0; }
.prop-page .invest-seal strong { color:var(--cream); font-size:12px; }
.prop-page .invest-seal span { font-size:11px; color:var(--muted); }

.prop-page .risk-card { padding:1.5rem; background:var(--bg2); border:1px solid rgba(200,130,107,0.2); border-radius:12px; font-size:12px; line-height:1.7; margin-top:1rem; }
.prop-page .risk-card strong { color:var(--cream); font-weight:500; }

.prop-page .prop-cta { text-align:center; padding:4rem 1.5rem; border-top:1px solid var(--border); max-width:900px; margin:0 auto; position:relative; overflow:hidden; }
.prop-page .cta-glow { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:400px; height:250px; background:radial-gradient(ellipse,rgba(200,130,107,0.08) 0%,transparent 70%); pointer-events:none; }
.prop-page .cta-title { font-family:'Cinzel',Georgia,serif; font-size:clamp(24px,3vw,36px); font-weight:700; color:var(--cream); letter-spacing:-0.5px; margin-bottom:0.8rem; line-height:1.1; position:relative; }
.prop-page .cta-sub { font-size:13px; color:var(--muted); margin-bottom:2rem; position:relative; }
.prop-page .cta-btns { display:flex; gap:0.8rem; justify-content:center; position:relative; }
.prop-page .cta-btn-primary { padding:12px 28px; background:var(--bronze); color:var(--bg); font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; border:none; cursor:default; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }

.prop-page .prop-footer { border-top:1px solid var(--border); padding:1.5rem; display:flex; justify-content:space-between; align-items:center; max-width:900px; margin:0 auto; }
.prop-page .footer-logo { font-family:'Cinzel',Georgia,serif; font-size:13px; font-weight:600; color:var(--muted); }
.prop-page .footer-logo span { color:var(--bronze); }
.prop-page .footer-note { font-size:10px; color:var(--muted); }

/* Resumo Executivo */
.prop-page .re-section { padding:2.5rem 1.5rem 1rem; max-width:900px; margin:0 auto; border-top:1px solid var(--border); }
.prop-page .re-ident { margin-bottom:1.5rem; }
.prop-page .re-ident-label { font-size:9px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); margin-bottom:0.4rem; }
.prop-page .re-name { font-family:'Cinzel',Georgia,serif; font-size:clamp(22px,3vw,32px); font-weight:400; color:var(--cream); line-height:1.15; margin-bottom:0.3rem; }
.prop-page .re-type { font-size:12px; color:var(--muted); }
.prop-page .re-understand { margin-bottom:1.5rem; padding:1rem 1.2rem; border-left:3px solid var(--bronze); background:rgba(200,130,107,0.03); border-radius:0 10px 10px 0; }
.prop-page .re-understand-label { font-size:8px; font-weight:500; letter-spacing:0.18em; text-transform:uppercase; color:var(--bronze); margin-bottom:0.5rem; }
.prop-page .re-understand-text { font-size:12px; line-height:1.7; color:var(--text); margin:0; font-weight:300; }
.prop-page .re-oneliner { margin-bottom:2rem; text-align:center; padding:1rem 0.8rem; }
.prop-page .re-oneliner-label { font-size:9px; font-weight:500; letter-spacing:0.2em; text-transform:uppercase; color:var(--bronze); margin-bottom:0.5rem; }
.prop-page .re-oneliner-text { font-family:'Cinzel',Georgia,serif; font-size:clamp(14px,2vw,18px); font-weight:500; color:var(--cream); line-height:1.35; }
.prop-page .re-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:0.5rem; margin-bottom:2rem; }
.prop-page .re-card { padding:1rem 0.8rem; background:var(--bg2); border:1px solid var(--border); border-radius:10px; text-align:center; }
.prop-page .re-card-icon { color:var(--bronze); margin-bottom:0.5rem; opacity:0.7; }
.prop-page .re-card-label { font-size:8px; font-weight:500; letter-spacing:0.15em; text-transform:uppercase; color:var(--muted); margin-bottom:0.4rem; }
.prop-page .re-card-value { font-family:'Cinzel',Georgia,serif; font-size:clamp(16px,2vw,22px); font-weight:600; color:var(--cream); margin-bottom:0.2rem; line-height:1.1; }
.prop-page .re-card-detail { font-size:9px; color:var(--muted); line-height:1.4; }
.prop-page .re-card-pill { display:inline-block; margin-top:0.4rem; padding:2px 8px; font-size:8px; font-weight:500; color:var(--bronze); background:rgba(200,130,107,0.1); border:1px solid rgba(200,130,107,0.2); border-radius:100px; }
.prop-page .re-list-section { margin-bottom:1.5rem; }
.prop-page .re-list-title { font-family:'Cinzel',Georgia,serif; font-size:13px; font-weight:500; color:var(--cream); margin-bottom:0.6rem; }
.prop-page .re-list { display:grid; gap:0.4rem; }
.prop-page .re-list-item { display:flex; align-items:flex-start; gap:0.5rem; padding:0.5rem 0.7rem; font-size:11px; line-height:1.5; border-radius:7px; }
.prop-page .re-list-item--check { background:var(--bg2); border:1px solid var(--border); color:var(--text); }
.prop-page .re-list-item--exclude { background:rgba(255,255,255,0.015); color:var(--muted); font-size:10px; }
.prop-page .re-icon-check { color:#5fd0b8; flex-shrink:0; margin-top:2px; }
.prop-page .re-icon-minus { color:var(--muted); flex-shrink:0; margin-top:3px; opacity:0.6; }
.prop-page .re-list-note { font-size:9px; color:var(--muted); font-style:italic; margin-top:0.4rem; }
.prop-page .re-action { text-align:center; padding:1.5rem 0.5rem 0.5rem; }
.prop-page .re-action-text { font-size:12px; color:var(--text); margin-bottom:0.8rem; font-weight:400; }
.prop-page .re-action-btn { display:inline-flex; align-items:center; gap:5px; padding:8px 20px; background:var(--bronze); color:var(--bg); font-size:9px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; border-radius:8px; cursor:default; }
.prop-page .re-divider { display:flex; align-items:center; gap:0.8rem; padding:1.5rem 0 0.5rem; }
.prop-page .re-divider-line { flex:1; height:1px; background:linear-gradient(to right,transparent,var(--border),transparent); }
.prop-page .re-divider-center { text-align:center; flex-shrink:0; }
.prop-page .re-divider-label { display:block; font-size:8px; font-weight:500; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted); }
.prop-page .re-divider-sub { display:block; font-family:'Cinzel',Georgia,serif; font-size:10px; font-style:italic; color:var(--muted); margin-top:0.2rem; opacity:0.7; }
`;
