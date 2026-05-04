'use client';

import { useReveal } from './useReveal';

export default function CTASection() {
  const revealRef = useReveal();

  return (
    <section className="cta-section" id="contato">
      <div className="reveal" ref={revealRef}>
        <div className="section-eyebrow" style={{ justifyContent: 'center', display: 'inline-flex' }}>
          04 / Iniciar Projeto
        </div>
        <p className="cta-quote">
          Toda parceria começa com uma <span className="accent">conversa estruturada.</span>
        </p>

        <p className="cta-explanation">
          Conte-nos sobre seu desafio. Você terá um primeiro contato organizado, e nas
          etapas seguintes refinamos o escopo até a proposta. <strong>Selecionamos
          projetos a cada ciclo</strong> — não atendemos demanda em massa.
        </p>

        <div className="cta-actions">
          <a
            href="https://wa.me/5543920004252?text=Ol%C3%A1%2C%20vim%20pelo%20site%20e%20gostaria%20de%20conversar%20sobre%20um%20projeto."
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary btn-sofia"
          >
            Iniciar conversa
            <span className="arrow">→</span>
          </a>
          <a
            href="/proposta"
            className="cases-show-all"
            style={{ padding: '1.1rem 2rem' }}
          >
            Acessar proposta
            <span className="arrow">→</span>
          </a>
        </div>

        <div className="cta-criteria">
          <div className="criteria-item">
            <div className="criteria-label">Engajamento mínimo</div>
            <div className="criteria-value">Projetos a partir de 8 semanas</div>
          </div>
        </div>
      </div>
    </section>
  );
}
