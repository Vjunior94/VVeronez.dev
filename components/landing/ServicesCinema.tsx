'use client';

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useReveal } from './useReveal';
import {
  DemoBrowser,
  DemoPhone,
  DemoDashboard,
  DemoFlow,
  DemoCheckout,
  DemoChat,
} from './ServicesCinemaDemos';

interface Service {
  titulo: string;
  desc: string;
  icon: ReactNode;
  demo: () => ReactNode;
}

const services: Service[] = [
  {
    titulo: 'Sites institucionais',
    desc: 'Páginas que apresentam sua marca e convertem visitantes em contatos. Estratégia de posicionamento incluída.',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="14" rx="1.5" />
        <path d="M3 9 H21 M7 6.5 L7.01 6.5 M10 6.5 L10.01 6.5" />
      </>
    ),
    demo: () => <DemoBrowser />,
  },
  {
    titulo: 'Aplicativos móveis',
    desc: 'Apps que rodam direto no celular do usuário, sem instalação. Funcionam em iPhone e Android com a mesma base.',
    icon: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M11 18 H13" />
      </>
    ),
    demo: () => <DemoPhone />,
  },
  {
    titulo: 'Sistemas internos',
    desc: 'Painéis administrativos sob medida pra gestão do seu negócio — estoque, finanças, equipe, qualquer coisa.',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M3 9 H21 M9 9 V21 M14 13 H18 M14 16 H18 M14 19 H18" />
      </>
    ),
    demo: () => <DemoDashboard />,
  },
  {
    titulo: 'Automações',
    desc: 'Tarefas repetitivas executadas sozinhas — envio de mensagens, integração entre ferramentas, processos completos.',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7 7 M17 17 L19 19 M5 19 L7 17 M17 7 L19 5" />
      </>
    ),
    demo: () => <DemoFlow />,
  },
  {
    titulo: 'Lojas online',
    desc: 'E-commerce completo com pagamento, frete, marketplaces (Mercado Livre, Shopee) e controle financeiro.',
    icon: (
      <>
        <path d="M3 6 H21 L19 18 H5 Z" />
        <circle cx="9" cy="21" r="1" />
        <circle cx="17" cy="21" r="1" />
        <path d="M3 6 L2 3 H0" />
      </>
    ),
    demo: () => <DemoCheckout />,
  },
  {
    titulo: 'Agentes de IA',
    desc: 'Assistentes inteligentes que atendem clientes, qualificam leads, geram propostas e executam tarefas reais.',
    icon: (
      <>
        <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z" />
        <path d="M9 11 L9.01 11 M15 11 L15.01 11 M9 15 Q12 17 15 15" />
      </>
    ),
    demo: () => <DemoChat />,
  },
];

export default function ServicesCinema() {
  const headerRef = useReveal();
  const [currentIdx, setCurrentIdx] = useState(0);
  // A key that increments to force remounting demos
  const [demoKey, setDemoKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const total = services.length;

  const goTo = useCallback((idx: number) => {
    setCurrentIdx(idx);
    setDemoKey((k) => k + 1);
  }, []);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentIdx((prev) => {
        const next = (prev + 1) % total;
        setDemoKey((k) => k + 1);
        return next;
      });
      scheduleNext();
    }, 6000);
  }, [total]);

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleNext]);

  const handlePrev = () => {
    goTo((currentIdx - 1 + total) % total);
    scheduleNext();
  };

  const handleNext = () => {
    goTo((currentIdx + 1) % total);
    scheduleNext();
  };

  const handleIndicator = (i: number) => {
    goTo(i);
    scheduleNext();
  };

  const handleCardClick = (i: number, pos: string) => {
    if (pos === 'prev' || pos === 'next') {
      goTo(i);
      scheduleNext();
    }
  };

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseLeave = () => {
    scheduleNext();
  };

  function getPos(i: number): string {
    if (i === currentIdx) return 'active';
    if (i === (currentIdx - 1 + total) % total) return 'prev';
    if (i === (currentIdx + 1) % total) return 'next';
    return 'far';
  }

  return (
    <section className="content" id="servicos">
      <div className="ambient-glow" style={{ top: '10%', right: '-100px' }} />
      <div className="section-header reveal" ref={headerRef}>
        <div className="section-eyebrow">01 / Capacidades</div>
        <h2 className="section-title">
          Frentes de <em>trabalho</em>.
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '1.5rem', fontSize: '0.95rem', maxWidth: '600px' }}>
          Cada frente, demonstrada ao vivo.
        </p>
      </div>

      <div
        className="services-cinema"
        ref={stageRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button className="cinema-arrow cinema-arrow-prev" aria-label="Card anterior" onClick={handlePrev}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
        </button>
        <button className="cinema-arrow cinema-arrow-next" aria-label="Próximo card" onClick={handleNext}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6 L15 12 L9 18" />
          </svg>
        </button>

        {services.map((s, i) => {
          const pos = getPos(i);
          return (
            <div
              key={i}
              className="cinema-card"
              data-pos={pos}
              onClick={() => handleCardClick(i, pos)}
            >
              <div className="cinema-card-inner">
                <div className="cinema-header">
                  <svg
                    className="cinema-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {s.icon}
                  </svg>
                  <div className="cinema-titles">
                    <div className="cinema-num">
                      {String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                    </div>
                    <div className="cinema-title">{s.titulo}</div>
                  </div>
                  <div className="cinema-live">Demo</div>
                </div>
                <div className="cinema-demo">
                  {pos === 'active' ? <div key={demoKey}>{s.demo()}</div> : null}
                </div>
                <div className="cinema-desc">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cinema-indicators">
        {services.map((s, i) => (
          <button
            key={i}
            className="cinema-indicator"
            data-active={i === currentIdx ? 'true' : 'false'}
            aria-label={`Mostrar ${s.titulo}`}
            onClick={() => handleIndicator(i)}
          />
        ))}
      </div>
    </section>
  );
}
