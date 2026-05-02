'use client';

import HeroBackground from './HeroBackground';
import SignatureV3D from './SignatureV3D';

export default function HeroSection() {
  return (
    <section className="hero">
      <HeroBackground />
      <div className="hero-corners">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
      </div>

      <div className="hero-content">
        <div className="hero-tag">Engenharia · IA Agêntica · Produtos Digitais</div>
        <h1 className="hero-title">
          <span className="outline">Engenharia de Software</span>
          <br />
          para <span className="gold">solução de problemas</span>.
        </h1>
        <p className="hero-subtitle">
          Engenharia de software para empresas que tratam tecnologia como{' '}
          <strong>ativo estratégico</strong> — não como custo operacional.
        </p>
        <div className="hero-actions">
          <a href="#projetos" className="hero-cta">
            Ver projetos
            <span className="arrow">→</span>
          </a>
          <a href="#contato" className="hero-cta hero-cta-secondary">
            Conversar
            <span className="arrow">→</span>
          </a>
        </div>

        <SignatureV3D variant="hero" />
      </div>

      <div className="scroll-hint">Scroll</div>
    </section>
  );
}
