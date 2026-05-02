'use client';

import { useReveal } from './useReveal';

const steps = [
  {
    num: '01',
    title: 'Imersão',
    desc: 'Entendemos seu negócio profundamente. Operação, dados, limitações, pessoas envolvidas. O escopo certo nasce dessa conversa — não de um briefing genérico.',
  },
  {
    num: '02',
    title: 'Arquitetura',
    desc: 'Desenhamos a stack, a arquitetura de dados e o fluxo de produto. Você recebe um documento técnico claro antes de qualquer linha de código ser escrita.',
  },
  {
    num: '03',
    title: 'Construção',
    desc: 'Execução em ciclos curtos com entregas semanais. Você acompanha o progresso em ambiente real — não em mockups, não em apresentações.',
  },
  {
    num: '04',
    title: 'Refinamento',
    desc: 'Ajustes baseados em uso real. O projeto sai com plano de evolução escrito — não termina na entrega, segue como ativo da sua operação.',
  },
];

function ProcessStep({ num, title, desc }: { num: string; title: string; desc: string }) {
  const ref = useReveal();
  return (
    <div className="process-step reveal" ref={ref}>
      <div className="process-num">{num}</div>
      <div className="process-title">{title}</div>
      <div className="process-desc">{desc}</div>
    </div>
  );
}

export default function ProcessSection() {
  const headerRef = useReveal();

  return (
    <section className="content process-section" id="processo">
      <div className="ambient-glow" style={{ top: '20%', right: '-120px' }} />
      <div className="section-header reveal" ref={headerRef}>
        <div className="section-eyebrow">02 / Process</div>
        <h2 className="section-title">
          Metodologia em <em>quatro etapas</em>.
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '1.5rem', fontSize: '0.95rem', maxWidth: '600px' }}>
          Cada projeto segue um processo estruturado. Sem improviso, sem retrabalho, sem cobrança por tentativa.
        </p>
      </div>

      <div className="process-grid">
        {steps.map((step) => (
          <ProcessStep key={step.num} {...step} />
        ))}
      </div>
    </section>
  );
}
