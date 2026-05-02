'use client';

import { useState, useCallback } from 'react';
import { projects, type Project } from '@/lib/projects-data';
import { useReveal } from './useReveal';
import ProjectModal from './ProjectModal';

export default function SelectedWork() {
  const headerRef = useReveal();
  const heroCaseRef = useReveal();
  const gridRef = useReveal();
  const footerRef = useReveal();

  const [modalProject, setModalProject] = useState<Project | null>(null);
  const [modalIndex, setModalIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Hero case: E-commerce com Inteligência Financeira
  const heroIdx = projects.findIndex((p) => p.hero);
  const heroProject = heroIdx >= 0 ? projects[heroIdx] : projects[0];
  const heroProjectIdx = heroIdx >= 0 ? heroIdx : 0;

  // 2 secondary projects shown initially (by title)
  const featuredTitles = [
    'Plataforma de Treinos Personalizados',
    'Agente de Atendimento Comercial',
  ];
  const secondaryProjects: { project: Project; originalIdx: number }[] = [];
  for (const title of featuredTitles) {
    const idx = projects.findIndex((p) => p.titulo === title);
    if (idx >= 0) secondaryProjects.push({ project: projects[idx], originalIdx: idx });
  }

  // Reserve: all remaining projects
  const featuredIdxs = new Set([heroProjectIdx, ...secondaryProjects.map((s) => s.originalIdx)]);
  const reserveProjects: { project: Project; originalIdx: number }[] = [];
  for (let i = 0; i < projects.length; i++) {
    if (!featuredIdxs.has(i)) {
      reserveProjects.push({ project: projects[i], originalIdx: i });
    }
  }

  const openModal = useCallback((p: Project, idx: number) => {
    setModalProject(p);
    setModalIndex(idx);
  }, []);

  const closeModal = useCallback(() => {
    setModalProject(null);
  }, []);

  const handleShowAll = () => {
    setExpanded(true);
  };

  return (
    <section className="content projects-section" id="projetos">
      <div className="ambient-glow" style={{ top: '30%', left: '-150px' }} />
      <div className="section-header reveal" ref={headerRef}>
        <div className="section-eyebrow">03 / Selected Work</div>
        <h2 className="section-title">
          Em <em>produção</em>.
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '1.5rem', fontSize: '0.95rem', maxWidth: '600px' }}>
          Casos selecionados — cada um resolvendo uma operação real.
        </p>
      </div>

      {/* Hero Case */}
      <div
        className="hero-case reveal"
        ref={heroCaseRef}
        onClick={() => openModal(heroProject, heroProjectIdx)}
      >
        <div className="hero-case-marker">Caso protagonista</div>
        <div className="hero-case-titulo">{heroProject.titulo}</div>
        <p className="hero-case-desc">{heroProject.solucao}</p>
        <div className="hero-case-footer">
          <span className="hero-case-setor">{heroProject.setor}</span>
          <span>{heroProject.engajamento}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="cases-grid reveal" ref={gridRef}>
        {secondaryProjects.map(({ project: p, originalIdx }, displayIdx) => (
          <div
            key={originalIdx}
            className="case-card"
            onClick={() => openModal(p, originalIdx)}
          >
            <div className="case-card-marker">
              {String(displayIdx + 2).padStart(2, '0')} · Caso
            </div>
            <div className="case-card-titulo">{p.titulo}</div>
            <div className="case-card-desc">{p.solucao}</div>
            <div className="case-card-footer">
              <span className="case-card-setor">{p.setor}</span>
              <span>{p.engajamento}</span>
            </div>
          </div>
        ))}

        {expanded &&
          reserveProjects.map(({ project: p, originalIdx }, displayIdx) => (
            <div
              key={originalIdx}
              className="case-card"
              onClick={() => openModal(p, originalIdx)}
            >
              <div className="case-card-marker">
                {String(secondaryProjects.length + displayIdx + 2).padStart(2, '0')} · Caso
              </div>
              <div className="case-card-titulo">{p.titulo}</div>
              <div className="case-card-desc">{p.solucao}</div>
              <div className="case-card-footer">
                <span className="case-card-setor">{p.setor}</span>
                <span>{p.engajamento}</span>
              </div>
            </div>
          ))}
      </div>

      {/* Show all button */}
      {!expanded && reserveProjects.length > 0 && (
        <div className="cases-footer reveal" ref={footerRef}>
          <button className="cases-show-all" onClick={handleShowAll}>
            <span>Ver todos os trabalhos</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 6 L15 12 L9 18" />
            </svg>
          </button>
        </div>
      )}

      <ProjectModal project={modalProject} projectIndex={modalIndex} onClose={closeModal} />
    </section>
  );
}
