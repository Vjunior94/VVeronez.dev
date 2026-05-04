'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Send, Loader2, FileText, Trash2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Persistence helpers — Supabase as source of truth, localStorage as fast cache
function loadChatLocal(propostaId: string): Message[] {
  try { return JSON.parse(localStorage.getItem(`agenor-chat:${propostaId}`) || '[]'); } catch { return []; }
}
function saveChatLocal(propostaId: string, msgs: Message[]) {
  try { localStorage.setItem(`agenor-chat:${propostaId}`, JSON.stringify(msgs)); } catch {}
}
function loadContextLocal(propostaId: string): any {
  try { return JSON.parse(localStorage.getItem(`agenor-ctx:${propostaId}`) || 'null'); } catch { return null; }
}
function saveContextLocal(propostaId: string, ctx: any) {
  try { localStorage.setItem(`agenor-ctx:${propostaId}`, JSON.stringify(ctx)); } catch {}
}

// Debounced save to Supabase (avoids hammering DB during streaming)
let saveTimer: ReturnType<typeof setTimeout> | null = null;
async function saveChatToSupabase(propostaId: string, msgs: Message[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.from('propostas').update({ agenor_chat: msgs }).eq('id', propostaId);
    } catch (e) { console.error('Erro ao salvar chat no Supabase:', e); }
  }, 1500);
}

function saveChat(propostaId: string, msgs: Message[]) {
  saveChatLocal(propostaId, msgs);
  saveChatToSupabase(propostaId, msgs);
}

async function loadChatFromSupabase(propostaId: string): Promise<Message[] | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data } = await supabase.from('propostas').select('agenor_chat').eq('id', propostaId).single();
    if (data?.agenor_chat && Array.isArray(data.agenor_chat) && data.agenor_chat.length > 0) {
      return data.agenor_chat as Message[];
    }
  } catch {}
  return null;
}

export default function RevisarPropostaPage() {
  const params = useParams();
  const router = useRouter();
  const propostaId = params.id as string;

  // Restore from localStorage immediately (fast), then check Supabase
  const [messages, setMessages] = useState<Message[]>(() => loadChatLocal(propostaId));
  const [propostaContext, setPropostaContext] = useState<any>(() => loadContextLocal(propostaId));

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clienteNome, setClienteNome] = useState('');
  const [propostaFinal, setPropostaFinal] = useState<any>(null);
  const [savingFinal, setSavingFinal] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);

  // Keep ref in sync and persist every change
  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length > 0) saveChat(propostaId, messages);
  }, [messages, propostaId]);

  // On mount: if localStorage is empty, try loading from Supabase (cross-browser recovery)
  useEffect(() => {
    if (messages.length === 0) {
      loadChatFromSupabase(propostaId).then(supaChat => {
        if (supaChat && supaChat.length > 0) {
          setMessages(supaChat);
          saveChatLocal(propostaId, supaChat);
        }
      });
    }
  }, []);

  // Check for final JSON in existing messages (in case page reloaded after generation)
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'assistant') {
        const match = msg.content.match(/```json:proposta_final\s*([\s\S]*?)```/);
        if (match) {
          try { setPropostaFinal(JSON.parse(match[1].trim())); } catch {}
        }
      }
    }
  }, []);

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

      // Only build context if not already cached locally
      if (!propostaContext) {
        const [modsRes, servsRes, fichaRes, frasesRes] = await Promise.all([
          supabase.from('proposta_modulos').select('*').eq('proposta_id', propostaId).order('ordem'),
          supabase.from('proposta_servicos').select('*').eq('proposta_id', propostaId),
          supabase.from('ficha_campos').select('campo, valor_estruturado, confianca').eq('lead_id', proposta.lead_id),
          supabase.from('frases_ouro').select('frase, categoria, por_que_importa').eq('lead_id', proposta.lead_id),
        ]);

        const ctx = {
          cliente: nome,
          resumo: proposta.resumo,
          modulos: (modsRes.data ?? []).map((m: any) => ({ nome: m.nome, descricao: m.descricao, horas: m.horas_estimadas, fase: m.fase })),
          stack: proposta.stack_recomendada,
          cronograma: proposta.cronograma,
          custo_total: proposta.custo_total_centavos / 100,
          total_horas: proposta.total_horas,
          servicos: (servsRes.data ?? []).map((s: any) => ({ nome: s.nome, custo_mensal: s.custo_mensal_centavos / 100 })),
          riscos: proposta.riscos,
          observacoes: proposta.observacoes,
          ficha: (fichaRes.data ?? []).map((f: any) => ({ campo: f.campo, valor: f.valor_estruturado, confianca: f.confianca })),
          frases_ouro: (frasesRes.data ?? []).map((f: any) => ({ frase: f.frase, categoria: f.categoria, por_que_importa: f.por_que_importa })),
        };

        setPropostaContext(ctx);
        saveContextLocal(propostaId, ctx);

        // Only start conversation if there are NO existing messages
        if (messages.length === 0) {
          setLoading(false);
          const firstMessage: Message = { role: 'user', content: 'Vamos revisar esta proposta. Comece a entrevista.' };
          streamResponse([firstMessage], ctx);
          return;
        }
      }

      setLoading(false);
    }
    load();
  }, [propostaId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const streamResponse = useCallback(async (msgs: Message[], ctx?: any) => {
    setStreaming(true);
    const context = ctx || propostaContext;

    const withPlaceholder = [...msgs, { role: 'assistant' as const, content: '' }];
    setMessages(withPlaceholder);

    try {
      const res = await fetch('/api/agenor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, propostaContext: context }),
      });

      if (!res.ok) {
        const errMsgs = [...msgs, { role: 'assistant' as const, content: 'Erro ao conectar com o Agenor. Tente enviar sua mensagem novamente.' }];
        setMessages(errMsgs);
        saveChat(propostaId, errMsgs);
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

      // Save final state with complete assistant message
      const finalMsgs = [...msgs, { role: 'assistant' as const, content: fullText }];
      setMessages(finalMsgs);
      saveChat(propostaId, finalMsgs);

      // Check for proposal JSON — auto-save to Supabase when detected
      const jsonMatch = fullText.match(/```json:proposta_final\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          setPropostaFinal(parsed);
          // Auto-save to Supabase
          const supabase = createClient();
          supabase.from('propostas').update({ conteudo_pagina: parsed }).eq('id', propostaId)
            .then(() => console.log('JSON proposta_final salvo automaticamente no Supabase'));
        } catch (e) { console.error('Parse error:', e); }
      }
    } catch (e) {
      console.error('Stream error:', e);
      // Preserve messages, just add error note
      const current = messagesRef.current;
      if (current.length > 0 && current[current.length - 1].role === 'assistant' && !current[current.length - 1].content) {
        const fixed = [...current.slice(0, -1), { role: 'assistant' as const, content: 'Conexão perdida. Envie sua mensagem novamente.' }];
        setMessages(fixed);
        saveChat(propostaId, fixed);
      }
    } finally {
      setStreaming(false);
    }
  }, [propostaContext, propostaId]);

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    const newMsg: Message = { role: 'user', content: input.trim() };
    const allMsgs = [...messages, newMsg];
    setMessages(allMsgs);
    saveChat(propostaId, allMsgs);
    setInput('');
    streamResponse(allMsgs);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSaveAndEdit = async () => {
    if (!propostaFinal) return;
    setSavingFinal(true);
    const supabase = createClient();
    await supabase.from('propostas').update({ conteudo_pagina: propostaFinal }).eq('id', propostaId);
    router.push(`/propostas/editor/${propostaId}`);
  };

  const handleClearChat = async () => {
    if (!confirm('Limpar conversa e recomeçar? Isso não pode ser desfeito.')) return;
    localStorage.removeItem(`agenor-chat:${propostaId}`);
    localStorage.removeItem(`agenor-ctx:${propostaId}`);
    const supabase = createClient();
    await supabase.from('propostas').update({ agenor_chat: null }).eq('id', propostaId);
    setMessages([]);
    setPropostaFinal(null);
    setPropostaContext(null);
    window.location.reload();
  };

  function renderChat(text: string) {
    return text.split('\n').map((line, i) => {
      let rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      rendered = rendered.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:0.1rem 0.3rem;font-size:0.82em">$1</code>');
      if (line.startsWith('# ')) return <h3 key={i} style={{ fontSize: '1.1rem', color: 'var(--gold-100)', fontFamily: "var(--font-cinzel)", margin: '0.8rem 0 0.3rem' }} dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} />;
      if (line.startsWith('## ')) return <h4 key={i} style={{ fontSize: '0.95rem', color: 'var(--gold-100)', margin: '0.6rem 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: rendered.slice(3) }} />;
      if (line.startsWith('### ')) return <h5 key={i} style={{ fontSize: '0.88rem', color: 'var(--gold-300)', margin: '0.5rem 0 0.2rem' }} dangerouslySetInnerHTML={{ __html: rendered.slice(4) }} />;
      if (line.match(/^- /)) return <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.15rem' }}><span style={{ color: 'var(--gold-500)' }}>◆</span><span dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} /></div>;
      if (line.match(/^\d+\. /)) return <div key={i} style={{ marginBottom: '0.15rem' }} dangerouslySetInnerHTML={{ __html: rendered }} />;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} style={{ marginBottom: '0.15rem' }} dangerouslySetInnerHTML={{ __html: rendered }} />;
    });
  }

  if (loading && messages.length === 0) return <p style={{ color: 'var(--text-dim)' }}>Carregando dados da proposta...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--gold-300)', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="admin-page-title" style={{ marginBottom: '0.1rem', fontSize: '1.2rem' }}>
            Revisão com Agenor
          </h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Proposta para {clienteNome}
            {messages.length > 0 && <> · {messages.filter(m => m.content && m.role === 'user').length} mensagens</>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {propostaFinal && (
            <button onClick={handleSaveAndEdit} disabled={savingFinal} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1.4rem',
              background: 'linear-gradient(135deg, rgba(95,208,184,0.2), rgba(91,168,212,0.2))',
              border: '1px solid rgba(95,208,184,0.4)', color: '#5fd0b8',
              fontSize: '0.78rem', fontFamily: "var(--font-jetbrains)",
              letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            }}>
              {savingFinal ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={14} />}
              Abrir no Editor
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={handleClearChat} title="Limpar conversa e recomeçar" style={{
              display: 'flex', alignItems: 'center', background: 'none',
              border: '1px solid rgba(220,50,50,0.2)', color: '#e88',
              padding: '0.6rem', cursor: 'pointer',
            }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '0.8rem', flex: 1, minHeight: 0 }}>
      {/* Chat area */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div ref={chatRef} style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem',
        padding: '1rem', background: 'rgba(10,8,20,0.4)', border: '1px solid var(--border-subtle)',
        marginBottom: '0.8rem',
      }}>
        {messages.filter(m => !(m.role === 'user' && m.content === 'Vamos revisar esta proposta. Comece a entrevista.')).map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: msg.role === 'user' ? '70%' : '85%',
            padding: '0.8rem 1rem',
            background: msg.role === 'user' ? 'rgba(184, 130, 107, 0.12)' : 'rgba(20, 16, 30, 0.8)',
            border: msg.role !== 'user' ? '1px solid var(--border-subtle)' : 'none',
            borderRadius: '8px', fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)',
          }}>
            <div style={{ fontSize: '0.6rem', color: msg.role === 'user' ? 'var(--gold-300)' : 'var(--text-dim)', marginBottom: '0.3rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {msg.role === 'user' ? 'Valmir' : 'Agenor'}
            </div>
            <div>{renderChat(msg.content)}</div>
          </div>
        ))}
        {streaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', padding: '0.5rem' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', display: 'inline' }} /> Agenor está pensando...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <textarea
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={propostaFinal ? 'Proposta gerada! Clique "Abrir no Editor" ou peça alterações...' : 'Digite sua mensagem...'}
          rows={2}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)',
            color: 'var(--gold-100)', padding: '0.7rem 1rem', fontSize: '0.88rem',
            fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5,
          }}
        />
        <button onClick={handleSend} disabled={streaming || !input.trim()} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '48px', background: 'rgba(212,160,74,0.15)',
          border: '1px solid rgba(212,160,74,0.3)', color: 'var(--gold-100)',
          cursor: streaming ? 'wait' : 'pointer', flexShrink: 0,
        }}>
          <Send size={18} />
        </button>
      </div>
      </div>{/* end chat column */}

      {/* Sidebar */}
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.78rem' }}>
        {propostaContext?.modulos?.length > 0 && (
          <div style={{ padding: '0.8rem', background: 'rgba(10,8,20,0.4)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.12em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Módulos ({propostaContext.modulos.length})
            </div>
            {propostaContext.modulos.map((m: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--gold-100)' }}>{m.nome}</span>
                <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{m.horas}h · {m.fase?.toUpperCase()}</span>
              </div>
            ))}
            <div style={{ marginTop: '0.4rem', fontFamily: "var(--font-jetbrains)", color: 'var(--gold-300)' }}>
              Total: {propostaContext.total_horas}h · R$ {propostaContext.custo_total?.toLocaleString('pt-BR')}
            </div>
          </div>
        )}
        {propostaContext?.ficha?.filter((f: any) => f.confianca === 'baixa').length > 0 && (
          <div style={{ padding: '0.8rem', background: 'rgba(232,93,117,0.05)', border: '1px solid rgba(232,93,117,0.15)' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.12em', color: '#e85d75', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Baixa confiança</div>
            {propostaContext.ficha.filter((f: any) => f.confianca === 'baixa').map((f: any, i: number) => (
              <div key={i} style={{ marginBottom: '0.3rem' }}><span style={{ color: '#e85d75', fontWeight: 500 }}>{f.campo}:</span> <span style={{ color: 'var(--text-muted)' }}>{f.valor}</span></div>
            ))}
          </div>
        )}
        {propostaContext?.frases_ouro?.length > 0 && (
          <div style={{ padding: '0.8rem', background: 'rgba(212,160,74,0.05)', border: '1px solid rgba(212,160,74,0.15)' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.12em', color: '#d4a04a', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Frases do cliente ({propostaContext.frases_ouro.length})</div>
            {propostaContext.frases_ouro.map((f: any, i: number) => (
              <div key={i} style={{ marginBottom: '0.4rem', fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '2px solid rgba(212,160,74,0.3)', paddingLeft: '0.5rem' }}>
                &ldquo;{f.frase}&rdquo;
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontStyle: 'normal' }}>{f.categoria}</div>
              </div>
            ))}
          </div>
        )}
        {propostaContext?.servicos?.length > 0 && (
          <div style={{ padding: '0.8rem', background: 'rgba(10,8,20,0.4)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.6rem', fontFamily: "var(--font-jetbrains)", letterSpacing: '0.12em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Serviços mensais</div>
            {propostaContext.servicos.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>{s.nome}</span>
                <span style={{ color: 'var(--gold-300)' }}>R$ {s.custo_mensal}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>{/* end grid */}
    </div>
  );
}
