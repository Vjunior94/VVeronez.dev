'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

// ─── Types ───────────────────────────────────────────────────────────────

type StepWho = 'agent' | 'user' | 'system';

interface Step {
  who: StepWho;
  text: string;
  options?: string[];
}

interface RenderedMsg {
  who: StepWho;
  text: string;
}

// ─── Chat Script ─────────────────────────────────────────────────────────

const HORARIO_MAP: Record<string, string> = {
  'Seg \u00b7 14h': 'segunda-feira, \u00e0s 14h',
  'Ter \u00b7 9h30': 'ter\u00e7a-feira, \u00e0s 9h30',
  'Qua \u00b7 16h': 'quarta-feira, \u00e0s 16h',
};

const SCRIPT: Step[] = [
  { who: 'user', text: 'Boa noite! Voc\u00eas t\u00eam pediatra? Queria marcar uma consulta pro meu filho' },
  { who: 'agent', text: 'Boa noite! \ud83d\ude0a Temos sim \u2014 atendemos com o Dr. Franklin Ribeiro, pediatra e neonatologista. Vou verificar os hor\u00e1rios e deixar tudo agendado pra voc\u00ea.' },
  { who: 'agent', text: 'Primeiro preciso de alguns dados. Qual \u00e9 o nome completo da crian\u00e7a?' },
  { who: 'user', text: 'Th\u00e9o Almeida Costa' },
  { who: 'agent', text: 'E a data de nascimento do Th\u00e9o?' },
  { who: 'user', text: '02/08/2021' },
  { who: 'agent', text: 'Perfeito. E o seu nome, como respons\u00e1vel?' },
  { who: 'user', text: 'Carla Almeida Costa' },
  { who: 'agent', text: 'Voc\u00ea vai usar conv\u00eanio ou ser\u00e1 particular?' },
  { who: 'user', text: '', options: ['Unimed', 'Particular'] },
  { who: 'agent', text: 'Anotado! \u2705 Tenho estes hor\u00e1rios com o Dr. Franklin na pr\u00f3xima semana:' },
  { who: 'agent', text: '', options: ['Seg \u00b7 14h', 'Ter \u00b7 9h30', 'Qua \u00b7 16h'] },
  { who: 'user', text: '__CHOSEN_SCHEDULE__' },
  { who: 'agent', text: 'Pronto, Carla! Consulta do Th\u00e9o agendada para **__HORARIO_EXTENSO__**, com o Dr. Franklin Ribeiro. \ud83c\udf89' },
  { who: 'agent', text: 'O cadastro do Th\u00e9o j\u00e1 est\u00e1 feito \u2014 voc\u00eas chegam e v\u00e3o direto pro atendimento, sem preencher ficha. Envio um lembrete um dia antes. At\u00e9 l\u00e1! \ud83d\ude09' },
  { who: 'system', text: '\u2713 Consulta agendada e paciente cadastrado no sistema' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function typingDelay(text: string) {
  return Math.min(400 + text.length * 16, 1500);
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// ─── WhatsApp Demo Component ────────────────────────────────────────────

function WhatsAppDemo() {
  const [messages, setMessages] = useState<RenderedMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingOptions, setPendingOptions] = useState<string[] | null>(null);
  const [isScheduleChoice, setIsScheduleChoice] = useState(false);
  const [chosenSchedule, setChosenSchedule] = useState('');
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  // IntersectionObserver to auto-start
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || started) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  // Process steps
  useEffect(() => {
    if (!started || stepIndex >= SCRIPT.length || finished) return;

    const step = SCRIPT[stepIndex];

    // Step 11 (index 11) = schedule chips from Lia
    if (step.who === 'agent' && step.options) {
      // Show the options as chips for the user to pick
      const delay = step.text ? typingDelay(step.text) : 600;
      setTyping(true);
      const t = setTimeout(() => {
        setTyping(false);
        if (step.text) {
          setMessages(prev => [...prev, { who: 'agent', text: step.text }]);
        }
        setPendingOptions(step.options!);
        setIsScheduleChoice(true);
        setStepIndex(prev => prev + 1); // move past this step; next is user __CHOSEN_SCHEDULE__
      }, delay);
      return () => clearTimeout(t);
    }

    if (step.who === 'agent') {
      let finalText = step.text;
      if (finalText.includes('__HORARIO_EXTENSO__')) {
        finalText = finalText.replace('__HORARIO_EXTENSO__', HORARIO_MAP[chosenSchedule] || chosenSchedule);
      }
      const delay = typingDelay(finalText);
      setTyping(true);
      const t = setTimeout(() => {
        setTyping(false);
        setMessages(prev => [...prev, { who: 'agent', text: finalText }]);
        setStepIndex(prev => prev + 1);
      }, delay);
      return () => clearTimeout(t);
    }

    if (step.who === 'system') {
      const t = setTimeout(() => {
        setMessages(prev => [...prev, { who: 'system', text: step.text }]);
        setFinished(true);
      }, 500);
      return () => clearTimeout(t);
    }

    if (step.who === 'user') {
      if (step.text === '__CHOSEN_SCHEDULE__') {
        // Wait for schedule choice from pendingOptions
        return;
      }
      if (step.options) {
        setPendingOptions(step.options);
        setIsScheduleChoice(false);
      } else {
        setPendingOptions([step.text]);
        setIsScheduleChoice(false);
      }
    }
  }, [stepIndex, started, finished, chosenSchedule]);

  // Scroll on new messages/typing
  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, pendingOptions, scrollToBottom]);

  const handleChipClick = (text: string) => {
    if (isScheduleChoice) {
      setChosenSchedule(text);
      setMessages(prev => [...prev, { who: 'user', text }]);
      setPendingOptions(null);
      setIsScheduleChoice(false);
      // stepIndex is already at __CHOSEN_SCHEDULE__ step, advance past it
      setStepIndex(prev => prev + 1);
    } else {
      setMessages(prev => [...prev, { who: 'user', text }]);
      setPendingOptions(null);
      setStepIndex(prev => prev + 1);
    }
  };

  const reset = () => {
    setMessages([]);
    setTyping(false);
    setStepIndex(0);
    setPendingOptions(null);
    setIsScheduleChoice(false);
    setChosenSchedule('');
    setFinished(false);
    setStarted(false);
    setTimeout(() => setStarted(true), 100);
  };

  const headerStatus = typing ? 'digitando\u2026' : 'online';

  return (
    <div ref={sentinelRef} className="demo-sentinel">
      <div className="phone-frame">
        {/* WhatsApp Header */}
        <div className="wa-header">
          <div className="wa-header-back">{'←'}</div>
          <div className="wa-avatar">
            <Image src="/imunolab/logo.png" alt="ImunoLab Prime" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'contain' }} />
          </div>
          <div className="wa-header-info">
            <div className="wa-header-name">Lia &middot; ImunoLab Prime</div>
            <div className={`wa-header-status${typing ? ' wa-typing' : ''}`}>{typing ? 'digitando\u2026' : 'online'}</div>
          </div>
        </div>

        {/* Chat area */}
        <div className="wa-chat" ref={chatRef}>
          {/* Date divider */}
          <div className="wa-date-divider">S&Aacute;BADO &middot; 22h47</div>

          {messages.map((msg, i) => {
            if (msg.who === 'system') {
              return <div key={i} className="wa-system">{msg.text}</div>;
            }
            return (
              <div key={i} className={`wa-bubble wa-${msg.who}`}>
                <span>{renderBold(msg.text)}</span>
                <span className="wa-time">
                  22:47
                  {msg.who === 'user' && <span className="wa-check"> \u2713\u2713</span>}
                </span>
              </div>
            );
          })}

          {typing && (
            <div className="wa-bubble wa-agent">
              <div className="wa-typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        {/* Input area with chips */}
        <div className="wa-input-area">
          {pendingOptions ? (
            <div className="wa-chips">
              {pendingOptions.map((opt) => (
                <button key={opt} className="wa-chip" onClick={() => handleChipClick(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          ) : finished ? (
            <button className="wa-replay" onClick={reset}>
              \u21bb Reproduzir novamente
            </button>
          ) : (
            <div className="wa-input-placeholder">Mensagem</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section Components ─────────────────────────────────────────────────

function SectionReveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add('il-visible'); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`il-reveal ${className}`}>{children}</div>;
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function ImunoLabPage() {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'imuno777') {
      setAuthorized(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  if (!authorized) {
    return (
      <>
        <style>{pageCSS}</style>
        <div className="il-page il-gate">
          <form className="il-gate-form" onSubmit={handleSubmit}>
            <Image src="/imunolab/logo.png" alt="ImunoLab Prime" width={64} height={64} />
            <h2 className="il-gate-title">Acesso restrito</h2>
            <p className="il-gate-sub">Digite a senha para visualizar esta apresenta&ccedil;&atilde;o.</p>
            <input
              type="password"
              className={`il-gate-input${error ? ' il-gate-error' : ''}`}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="il-cta-btn">Acessar</button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageCSS}</style>
      <div className="il-page">

        {/* ── HERO ── */}
        <section className="il-hero">
          <SectionReveal>
            <div className="il-brand">
              <Image src="/imunolab/logo.png" alt="ImunoLab Prime" width={56} height={56} />
              <span className="il-brand-name">ImunoLab Prime</span>
            </div>
            <div className="il-eyebrow">Agente de atendimento por WhatsApp</div>
            <h1 className="il-h1">Nenhum paciente sem resposta.<br />Nenhuma chegada sem cadastro.</h1>
            <p className="il-sub">Um assistente de IA que responde no WhatsApp na hora, a qualquer hor&aacute;rio &mdash; e j&aacute; deixa o paciente pr&eacute;-cadastrado antes de chegar.</p>
            <div className="il-scroll-hint">&darr;</div>
          </SectionReveal>
        </section>

        {/* ── O PROBLEMA HOJE ── */}
        <section className="il-section">
          <SectionReveal>
            <h2 className="il-h2">Dois pontos que travam o atendimento hoje</h2>
            <div className="il-cards">
              <div className="il-card">
                <span className="il-card-icon">{'\u23f3'}</span>
                <h3 className="il-card-title">Paciente sem resposta no WhatsApp</h3>
              </div>
              <div className="il-card">
                <span className="il-card-icon">{'\ud83d\udccb'}</span>
                <h3 className="il-card-title">Paciente de pediatria chega sem cadastro</h3>
              </div>
            </div>
          </SectionReveal>
        </section>

        {/* ── A SOLUÇÃO EM AÇÃO ── */}
        <section className="il-section il-demo-section">
          <SectionReveal>
            <h2 className="il-h2">Veja a conversa acontecendo</h2>
            <p className="il-demo-instruction">{'\ud83d\udc46'} Toque nas respostas para conversar como se voc&ecirc; fosse o paciente</p>
          </SectionReveal>
          <WhatsAppDemo />
          <SectionReveal>
            <div className="il-demo-footer">
              <p><strong>Al&eacute;m do que voc&ecirc; viu acima</strong>, a Lia tamb&eacute;m <strong>remarca e cancela</strong> consultas de pediatria diretamente na agenda &mdash; tudo pela conversa do WhatsApp, em tempo real. Por tr&aacute;s, ela opera atrav&eacute;s de uma <strong>Central de Comando</strong> que se conecta ao <strong>Feegow</strong>, mant&eacute;m o hist&oacute;rico completo das conversas, fichas dos pacientes e acesso &agrave; agenda &mdash; tudo integrado em um s&oacute; lugar. A Central pode ser acessada pelo computador ou pelo app no celular.</p>
            </div>
          </SectionReveal>
        </section>

        {/* ── UPGRADES ── */}
        <section className="il-section">
          <SectionReveal>
            <h2 className="il-h2">Sugest&atilde;o de upgrades para a Lia, ap&oacute;s a entrega do MVP</h2>
            <p className="il-upgrades-intro">O MVP resolve o essencial. Mas a Lia pode crescer junto com o laborat&oacute;rio &mdash; alguns caminhos poss&iacute;veis:</p>
            <div className="il-upgrades">
              {[
                { title: 'Confirma\u00e7\u00e3o autom\u00e1tica de consulta.', body: 'No dia do atendimento, a Lia pede a confirma\u00e7\u00e3o de presen\u00e7a ao paciente \u2014 reduzindo faltas e janelas vazias na agenda.' },
                { title: 'Reagendamento proativo.', body: 'Se o paciente n\u00e3o confirma, a Lia oferece novos hor\u00e1rios e remaneja a agenda sozinha \u2014 o espa\u00e7o n\u00e3o fica vazio.' },
                { title: 'Consulta de informa\u00e7\u00f5es por comando.', body: 'A equipe pergunta em linguagem natural e a Lia responde na hora: \u201cLia, quando foi a \u00faltima consulta do Th\u00e9o Almeida?\u201d ou \u201cQual \u00e9 o meu pr\u00f3ximo paciente e do que se trata?\u201d' },
                { title: 'Resumo do dia para a equipe.', body: 'A equipe pergunta \u201cLia, como est\u00e1 a agenda de amanh\u00e3?\u201d e recebe na hora o panorama dos atendimentos.' },
                { title: 'Reconhecimento de quem est\u00e1 falando.', body: 'A Lia identifica se conversa com um paciente ou com a equipe e ajusta comportamento e permiss\u00f5es \u2014 atendimento pro paciente, acesso operacional pra equipe.' },
                { title: 'Aviso de cancelamento ao profissional.', body: 'Se o paciente agendado cancelar, a Lia avisa o profissional respons\u00e1vel na hora \u2014 sem depender de algu\u00e9m repassar a informa\u00e7\u00e3o.' },
                { title: 'Coleta de dados para pr\u00e9-triagem.', body: 'A Lia coleta sintomas e palavras-chave durante a conversa e gera uma lista de pacientes com pr\u00e9-an\u00e1lise antecipada, encaminhando casos que merecem aten\u00e7\u00e3o para o grupo no WhatsApp. Importante: em respeito \u00e0 legisla\u00e7\u00e3o nacional, a Lia n\u00e3o ir\u00e1 classificar urg\u00eancia \u2014 ela ir\u00e1 organizar as informa\u00e7\u00f5es para facilitar o trabalho de quem efetivamente far\u00e1 a triagem.' },
                { title: 'Transbordo para atendimento humano.', body: 'Quando algo foge do que ela resolve, a Lia encaminha pra recep\u00e7\u00e3o em vez de improvisar uma resposta.' },
              ].map((item, i) => (
                <div key={i} className="il-upgrade-item">
                  <span className="il-upgrade-diamond">{'\u25c7'}</span>
                  <div>
                    <strong>{item.title}</strong> {item.body}
                  </div>
                </div>
              ))}
            </div>
          </SectionReveal>
        </section>

        {/* ── COMO ISSO RESOLVE ── */}
        <section className="il-section">
          <SectionReveal>
            <h2 className="il-h2">Como isso resolve, ponto a ponto</h2>
            <div className="il-resolve-blocks">
              <div className="il-resolve-block">
                <div className="il-resolve-from">
                  <span className="il-resolve-icon-from">{'\u23f3'}</span>
                  <span>Paciente sem resposta no WhatsApp</span>
                </div>
                <div className="il-resolve-to">
                  <span className="il-resolve-check">{'\u2713'}</span>
                  <div>
                    <strong>Resposta imediata, dia e noite</strong> &mdash; para todos os pacientes (exames, vacinas, pediatria). A Lia responde d&uacute;vidas de hor&aacute;rio, jejum, exames e conv&ecirc;nios em segundos &mdash; inclusive de madrugada e no fim de semana. Ningu&eacute;m fica esperando.
                  </div>
                </div>
              </div>
              <div className="il-resolve-block">
                <div className="il-resolve-from">
                  <span className="il-resolve-icon-from">{'\ud83d\udccb'}</span>
                  <span>Paciente de pediatria chega sem cadastro</span>
                </div>
                <div className="il-resolve-to">
                  <span className="il-resolve-check">{'\u2713'}</span>
                  <div>
                    <strong>Agendamento e cadastro na conversa</strong> &mdash; para pediatria, integrado ao sistema <strong>Feegow</strong>. Nome, nascimento, respons&aacute;vel e conv&ecirc;nio s&atilde;o coletados pelo WhatsApp e a consulta &eacute; agendada na hora. O paciente chega e vai direto pro atendimento &mdash; sem ficha.
                  </div>
                </div>
              </div>
            </div>
            <div className="il-scope-box">
              <strong>Sobre este MVP:</strong> esta primeira vers&atilde;o foca APENAS nestes dois pontos &mdash; resposta imediata e pr&eacute;-cadastro. &Eacute; o suficiente para j&aacute; sentir o ganho no dia a dia. Outras melhorias podem ser consideradas antes, durante ou ap&oacute;s o desenvolvimento da solu&ccedil;&atilde;o.
            </div>
          </SectionReveal>
        </section>

        {/* ── GARANTIAS ── */}
        <section className="il-section">
          <SectionReveal>
            <h2 className="il-h2">Garantias</h2>
            <div className="il-garantias">
              <div className="il-garantia-item">
                <span className="il-garantia-icon">{'\ud83d\udee1\ufe0f'}</span>
                <div>
                  <strong>Conformidade com a LGPD</strong>
                  <p>Dados sens&iacute;veis de pacientes tratados com total conformidade &agrave; Lei Geral de Prote&ccedil;&atilde;o de Dados. Coleta, armazenamento e processamento seguem as diretrizes legais vigentes.</p>
                </div>
              </div>
              <div className="il-garantia-item">
                <span className="il-garantia-icon">{'\ud83d\udd0d'}</span>
                <div>
                  <strong>Observabilidade aplicada</strong>
                  <p>Monitoramento cont&iacute;nuo do sistema para identifica&ccedil;&atilde;o de problemas, corre&ccedil;&atilde;o r&aacute;pida de falhas e melhoria constante do desempenho da Lia.</p>
                </div>
              </div>
              <div className="il-garantia-item">
                <span className="il-garantia-icon">{'\ud83d\udd10'}</span>
                <div>
                  <strong>Criptografia de dados</strong>
                  <p>Informa&ccedil;&otilde;es protegidas com criptografia em tr&acirc;nsito e em repouso. Nenhum dado trafega ou &eacute; armazenado sem prote&ccedil;&atilde;o.</p>
                </div>
              </div>
              <div className="il-garantia-item">
                <span className="il-garantia-icon">{'\ud83d\udcdd'}</span>
                <div>
                  <strong>Registro de atividades</strong>
                  <p>Toda a&ccedil;&atilde;o da Lia &eacute; registrada e rastre&aacute;vel. Um hist&oacute;rico completo e audit&aacute;vel de cada intera&ccedil;&atilde;o, dispon&iacute;vel a qualquer momento.</p>
                </div>
              </div>
              <div className="il-garantia-item">
                <span className="il-garantia-icon">{'\u2696\ufe0f'}</span>
                <div>
                  <strong>Limites claros da IA</strong>
                  <p>A Lia responde apenas dentro do escopo treinado. N&atilde;o inventa informa&ccedil;&otilde;es cl&iacute;nicas, n&atilde;o faz diagn&oacute;sticos e n&atilde;o substitui profissionais de sa&uacute;de.</p>
                </div>
              </div>
              <div className="il-garantia-item">
                <span className="il-garantia-icon">{'\u2705'}</span>
                <div>
                  <strong>Disponibilidade 24/7</strong>
                  <p>Infraestrutura com monitoramento de uptime cont&iacute;nuo, garantindo que a Lia esteja sempre pronta para atender &mdash; inclusive fora do hor&aacute;rio comercial.</p>
                </div>
              </div>
            </div>
          </SectionReveal>
        </section>

        {/* ── INVESTIMENTO ── */}
        <section className="il-section">
          <SectionReveal>
            <h2 className="il-h2">Investimento</h2>
            <div className="il-invest-cards">
              <div className="il-invest-card">
                <div className="il-invest-label">Implementa&ccedil;&atilde;o</div>
                <div className="il-invest-tag">pagamento &uacute;nico</div>
                <div className="il-invest-old">R$ 8.000</div>
                <div className="il-invest-price">R$ 6.400</div>
                <div className="il-invest-discount">20% de desconto</div>
                <p className="il-invest-includes">Inclui: cria&ccedil;&atilde;o, implementa&ccedil;&atilde;o e <strong>integra&ccedil;&atilde;o total com o Feegow</strong></p>
                <div className="il-invest-avista">{'\ud83d\udcb0'} &Agrave; vista: <strong>R$ 5.760</strong> <span className="il-invest-avista-desc">10% de desconto adicional</span></div>
              </div>
              <div className="il-invest-card il-invest-card-monthly">
                <div className="il-invest-label">Mensalidade</div>
                <div className="il-invest-tag">estrutura + manuten&ccedil;&atilde;o</div>
                <div className="il-invest-price">R$ 500<span className="il-invest-mo">/m&ecirc;s</span></div>
              </div>
            </div>
            <p className="il-invest-note">Esta apresenta&ccedil;&atilde;o &eacute; um ponto de partida para, juntos, definirmos o melhor caminho. Detalhes como cronograma e prazo de entrega ser&atilde;o alinhados na conversa seguinte, de acordo com a realidade do laborat&oacute;rio.</p>
          </SectionReveal>
        </section>

        {/* ── CTA ── */}
        <section className="il-section il-cta">
          <SectionReveal>
            <a
              href="https://wa.me/5543988569827"
              target="_blank"
              rel="noopener noreferrer"
              className="il-cta-btn"
            >
              Vamos conversar
            </a>
          </SectionReveal>
        </section>

        {/* ── FOOTER ── */}
        <footer className="il-footer">
          Desenvolvido por{' '}
          <a href="https://vveronez.dev" target="_blank" rel="noopener noreferrer">vveronez.dev</a>
        </footer>
      </div>
    </>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────

const pageCSS = `
/* ── Reset for this page (override dark landing globals) ── */
.il-page {
  --il-primary: #8B1F2C;
  --il-accent: #C5A253;
  --il-bg: #FFFFFF;
  --il-bg-warm: #FAF8F5;
  --il-ink: #1E1314;
  --il-ink-muted: #5C4A4D;
  --il-border: #E8E0DA;

  background: var(--il-bg);
  color: var(--il-ink);
  font-family: var(--font-manrope), 'Manrope', sans-serif;
  font-weight: 400;
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.il-page *,
.il-page *::before,
.il-page *::after {
  box-sizing: border-box;
}

/* ── Access gate ── */
.il-gate {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.il-gate-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 340px;
  width: 100%;
  text-align: center;
}

.il-gate-title {
  font-family: var(--font-cinzel), 'Cinzel', serif;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--il-primary);
  margin: 0;
}

.il-gate-sub {
  font-size: 0.9rem;
  color: var(--il-ink-muted);
  margin: 0;
}

.il-gate-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--il-border);
  border-radius: 10px;
  font-size: 1rem;
  font-family: inherit;
  text-align: center;
  outline: none;
  transition: border-color 0.2s ease;
  color: var(--il-ink);
  background: var(--il-bg);
}

.il-gate-input:focus {
  border-color: var(--il-accent);
}

.il-gate-input.il-gate-error {
  border-color: #DC2626;
  animation: il-shake 0.4s ease;
}

@keyframes il-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

/* ── Reveal animation ── */
.il-reveal {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.8s ease, transform 0.8s ease;
}
.il-reveal.il-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Typography ── */
.il-h1 {
  font-family: var(--font-cinzel), 'Cinzel', serif;
  font-size: clamp(1.75rem, 5vw, 2.75rem);
  font-weight: 600;
  color: var(--il-primary);
  line-height: 1.2;
  letter-spacing: -0.01em;
  text-align: center;
  margin: 0;
}

.il-h2 {
  font-family: var(--font-cinzel), 'Cinzel', serif;
  font-size: clamp(1.35rem, 4vw, 2rem);
  font-weight: 600;
  color: var(--il-primary);
  line-height: 1.25;
  text-align: center;
  margin: 0 0 2rem;
}

.il-sub {
  font-size: clamp(1rem, 2.5vw, 1.15rem);
  color: var(--il-ink-muted);
  text-align: center;
  max-width: 520px;
  margin: 1.25rem auto 0;
  line-height: 1.6;
}

/* ── Hero ── */
.il-hero {
  padding: 3rem 1.5rem 2.5rem;
  text-align: center;
  background: var(--il-bg-warm);
  border-bottom: 1px solid var(--il-border);
}

.il-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.il-brand-name {
  font-family: var(--font-cinzel), 'Cinzel', serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--il-primary);
  letter-spacing: 0.02em;
}

.il-eyebrow {
  font-family: var(--font-jetbrains), 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--il-accent);
  background: rgba(197, 162, 83, 0.1);
  border: 1px solid rgba(197, 162, 83, 0.25);
  display: inline-block;
  padding: 0.35rem 1rem;
  border-radius: 100px;
  margin-bottom: 1.5rem;
}

.il-scroll-hint {
  margin-top: 2.5rem;
  font-size: 0.85rem;
  color: var(--il-ink-muted);
  opacity: 0.6;
  animation: il-bounce 2s infinite;
}

@keyframes il-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6px); }
}

/* ── Sections ── */
.il-section {
  padding: 3.5rem 1.5rem;
  max-width: 720px;
  margin: 0 auto;
}

.il-section:nth-child(even) {
  background: var(--il-bg-warm);
}

.il-demo-section {
  max-width: 100%;
  padding-left: 0;
  padding-right: 0;
}

.il-demo-section > .il-reveal {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* ── Problem cards ── */
.il-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.il-card {
  background: var(--il-bg);
  border: 1px solid var(--il-border);
  border-radius: 12px;
  padding: 1.5rem;
}

.il-card-icon {
  font-size: 1.75rem;
  display: block;
  margin-bottom: 0.75rem;
  text-align: center;
}

.il-card-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--il-primary);
  margin: 0 0 0.5rem;
  line-height: 1.35;
}

.il-card-scope {
  font-weight: 400;
  font-size: 0.85rem;
  color: var(--il-ink-muted);
  font-style: italic;
}

.il-card-body {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--il-ink-muted);
  margin: 0;
}

/* ── Demo section ── */
.il-demo-instruction {
  text-align: center;
  font-size: 0.9rem;
  color: var(--il-ink-muted);
  margin-bottom: 1.5rem;
}

.demo-sentinel {
  display: flex;
  justify-content: center;
  padding: 0 1rem;
}

/* ── Phone frame ── */
.phone-frame {
  width: 100%;
  max-width: 380px;
  height: 620px;
  border-radius: 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #E5DDD5;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
  position: relative;
}

/* ── WhatsApp header ── */
.wa-header {
  background: #008069;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  gap: 0.6rem;
  flex-shrink: 0;
}

.wa-header-back {
  font-size: 1.2rem;
  opacity: 0.85;
}

.wa-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wa-header-info {
  flex: 1;
  min-width: 0;
}

.wa-header-name {
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wa-header-status {
  font-size: 0.75rem;
  opacity: 0.85;
}

.wa-header-status.wa-typing {
  color: #A8F0D6;
}

/* ── Chat area ── */
.wa-chat {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M20 0v40M0 20h40' stroke='%23d4cdc4' stroke-width='0.5' fill='none' opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='400' height='400' fill='%23E5DDD5'/%3E%3Crect width='400' height='400' fill='url(%23p)'/%3E%3C/svg%3E");
}

.wa-chat::-webkit-scrollbar {
  width: 4px;
}
.wa-chat::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.15);
  border-radius: 4px;
}

/* ── Date divider ── */
.wa-date-divider {
  align-self: center;
  background: rgba(225,218,208,0.9);
  color: #54656F;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  margin-bottom: 6px;
  letter-spacing: 0.02em;
}

/* ── Bubbles ── */
.wa-bubble {
  max-width: 82%;
  padding: 0.5rem 0.6rem 0.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.45;
  position: relative;
  animation: il-bubble-in 0.3s ease;
  word-wrap: break-word;
}

@keyframes il-bubble-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.wa-agent {
  background: #FFFFFF;
  align-self: flex-start;
  border-top-left-radius: 0;
  color: #111B21;
  box-shadow: 0 1px 1px rgba(0,0,0,0.06);
}

.wa-user {
  background: #D8FDD2;
  align-self: flex-end;
  border-top-right-radius: 0;
  color: #111B21;
  box-shadow: 0 1px 1px rgba(0,0,0,0.06);
}

.wa-system {
  align-self: center;
  background: rgba(225,218,208,0.9);
  color: #54656F;
  font-size: 0.75rem;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  text-align: center;
  animation: il-bubble-in 0.3s ease;
}

.wa-time {
  font-size: 0.65rem;
  color: #667781;
  float: right;
  margin-left: 0.5rem;
  margin-top: 0.25rem;
}

.wa-check {
  color: #53BDEB;
  font-size: 0.7rem;
}

/* ── Typing indicator ── */
.wa-typing-indicator {
  display: flex;
  gap: 3px;
  padding: 0.25rem 0.1rem;
}

.wa-typing-indicator span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #90A4AE;
  animation: il-typing 1.2s infinite;
}

.wa-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.wa-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes il-typing {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

/* ── Input area ── */
.wa-input-area {
  background: #F0F2F5;
  padding: 0.5rem 0.75rem;
  flex-shrink: 0;
  min-height: 48px;
  display: flex;
  align-items: center;
}

.wa-input-placeholder {
  color: #667781;
  font-size: 0.9rem;
  background: #fff;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  flex: 1;
}

.wa-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  width: 100%;
}

.wa-chip {
  background: var(--il-bg);
  border: 1.5px solid #008069;
  color: #008069;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 44px;
  display: flex;
  align-items: center;
  font-family: inherit;
}

.wa-chip:hover {
  background: #008069;
  color: #fff;
}

.wa-chip:active {
  transform: scale(0.96);
}

.wa-replay {
  background: none;
  border: 1.5px solid #008069;
  color: #008069;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  cursor: pointer;
  margin: 0 auto;
  min-height: 44px;
  font-family: inherit;
  transition: all 0.15s ease;
}

.wa-replay:hover {
  background: #008069;
  color: #fff;
}

/* ── Demo footer text ── */
.il-demo-footer {
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  background: var(--il-bg-warm);
  border: 1px solid var(--il-border);
  border-radius: 12px;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--il-ink-muted);
}

.il-demo-footer p { margin: 0; }

/* ── Upgrades ── */
.il-upgrades-intro {
  text-align: center;
  color: var(--il-ink-muted);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.il-upgrades {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.il-upgrade-item {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--il-ink);
}

.il-upgrade-diamond {
  color: var(--il-accent);
  font-size: 1.1rem;
  flex-shrink: 0;
  line-height: 1;
}

/* ── Resolve blocks ── */
.il-resolve-blocks {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.il-resolve-block {
  background: var(--il-bg);
  border: 1px solid var(--il-border);
  border-radius: 12px;
  overflow: hidden;
}

.il-resolve-from {
  background: rgba(22, 163, 74, 0.06);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  color: #16A34A;
  border-bottom: 1px solid var(--il-border);
}

.il-resolve-icon-from {
  font-size: 1.1rem;
}

.il-resolve-to {
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--il-ink-muted);
}

.il-resolve-check {
  background: #16A34A;
  color: #fff;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}

.il-scope-box {
  margin-top: 1.5rem;
  padding: 1.25rem;
  background: rgba(197, 162, 83, 0.08);
  border: 1px solid rgba(197, 162, 83, 0.2);
  border-radius: 10px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--il-ink-muted);
}

/* ── Garantias ── */
.il-garantias {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.il-garantia-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  background: var(--il-bg);
  border: 1px solid var(--il-border);
  border-radius: 12px;
  padding: 1.25rem;
}

.il-garantia-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.il-garantia-item strong {
  display: block;
  font-size: 1rem;
  color: var(--il-primary);
  margin-bottom: 0.35rem;
}

.il-garantia-item p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--il-ink-muted);
}

/* ── Investment ── */
.il-invest-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.il-invest-card {
  background: var(--il-bg);
  border: 1px solid var(--il-border);
  border-radius: 14px;
  padding: 1.75rem 1.5rem;
  text-align: center;
}

.il-invest-card-monthly {
  background: var(--il-bg);
}

.il-invest-label {
  font-family: var(--font-cinzel), 'Cinzel', serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--il-primary);
  margin-bottom: 0.25rem;
}

.il-invest-tag {
  font-size: 0.75rem;
  color: var(--il-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 1rem;
}

.il-invest-old {
  font-size: 1.15rem;
  color: var(--il-ink-muted);
  text-decoration: line-through;
  margin-bottom: 0.25rem;
}

.il-invest-price {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--il-primary);
  line-height: 1.1;
}

.il-invest-mo {
  font-size: 1rem;
  font-weight: 400;
  color: var(--il-ink-muted);
}

.il-invest-discount {
  font-size: 0.85rem;
  color: var(--il-accent);
  font-weight: 600;
  margin-top: 0.25rem;
  margin-bottom: 1rem;
}

.il-invest-includes {
  font-size: 0.9rem;
  color: var(--il-ink-muted);
  line-height: 1.5;
  margin: 0 0 1rem;
}

.il-invest-avista {
  background: rgba(197, 162, 83, 0.08);
  border: 1px solid rgba(197, 162, 83, 0.2);
  border-radius: 8px;
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  color: var(--il-ink);
}

.il-invest-note {
  margin: 2rem auto 0;
  max-width: 520px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--il-ink);
  text-align: center;
  font-style: italic;
  background: rgba(197, 162, 83, 0.08);
  border: 1px solid rgba(197, 162, 83, 0.2);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
}

.il-invest-avista-desc {
  font-size: 0.8rem;
  color: var(--il-ink-muted);
  margin-left: 0.25rem;
}

/* ── CTA ── */
.il-cta {
  text-align: center;
  padding-top: 3rem;
  padding-bottom: 3rem;
  background: var(--il-bg-warm) !important;
}

.il-cta .il-h2 {
  margin-bottom: 1.5rem;
}

.il-cta-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--il-primary);
  color: #fff;
  font-size: 1.05rem;
  font-weight: 600;
  padding: 1rem 2.5rem;
  border-radius: 10px;
  text-decoration: none;
  min-height: 52px;
  transition: background 0.2s ease, transform 0.15s ease;
  font-family: inherit;
}

.il-cta-btn:hover {
  background: #6F1823;
  transform: translateY(-1px);
}

.il-cta-btn:active {
  transform: scale(0.98);
}

/* ── Footer ── */
.il-footer {
  text-align: center;
  padding: 1.5rem;
  font-size: 0.8rem;
  color: var(--il-ink-muted);
  border-top: 1px solid var(--il-border);
}

.il-footer a {
  color: var(--il-accent);
  text-decoration: none;
}

.il-footer a:hover {
  text-decoration: underline;
}

/* ── Desktop ── */
@media (min-width: 768px) {
  .il-hero {
    padding: 5rem 2rem 4rem;
  }

  .il-section {
    padding: 4.5rem 2rem;
  }

  .il-cards {
    flex-direction: row;
  }

  .il-card {
    flex: 1;
  }

  .il-invest-cards {
    flex-direction: row;
    align-items: stretch;
  }

  .il-invest-card {
    flex: 1;
  }

  .phone-frame {
    height: 660px;
  }
}
`;
