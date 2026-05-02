'use client';

import { useEffect, useCallback } from 'react';
import type { Project } from '@/lib/projects-data';

interface ProjectModalProps {
  project: Project | null;
  projectIndex: number;
  onClose: () => void;
}

export default function ProjectModal({ project, projectIndex, onClose }: ProjectModalProps) {
  const isActive = project !== null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={`modal-overlay${isActive ? ' active' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div className="modal-container">
        <div className="modal-scroll-content">
          {project && (
            <>
              <div className="modal-header">
                <div>
                  <div className="modal-meta">
                    {String(projectIndex + 1).padStart(2, '0')} · {project.setor}
                  </div>
                  <h3 className="modal-title">{project.titulo}</h3>
                  <div className="modal-engajamento">{project.engajamento}</div>
                </div>
                <button className="modal-close" aria-label="Minimizar" onClick={onClose}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 12 H19" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                <div className="modal-block">
                  <div className="modal-label">O problema</div>
                  <p className="modal-text">{project.problema}</p>
                </div>

                <div className="modal-block">
                  <div className="modal-label">A solução entregue</div>
                  <p className="modal-text">{project.solucao}</p>
                </div>

                <div className="modal-block">
                  <div className="modal-label">Destaques técnicos</div>
                  <ul className="modal-list">
                    {project.destaques.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                <div className="modal-block">
                  <div className="modal-label">Stack utilizada</div>
                  <div className="modal-tags">
                    {project.stack.map((s, i) => (
                      <span className="modal-tag" key={i}>{s}</span>
                    ))}
                  </div>
                </div>

                <div className="modal-block">
                  <div className="modal-label">Estrutura de arquivos</div>
                  <div className="modal-files">
                    {project.files.map((f, i) => {
                      const ext = f.split('.').pop() || '';
                      const name = f.replace('.' + ext, '');
                      return (
                        <div className="modal-file" key={i}>
                          <span className="file-icon">▸</span>
                          <span className="file-name">{name}</span>
                          <span className="file-ext">.{ext}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <a
                  href={`https://wa.me/PLACEHOLDER_NUMERO?text=Ol%C3%A1%2C%20vim%20pelo%20site%20e%20gostaria%20de%20conversar%20sobre%20um%20projeto%20similar%20a%20${encodeURIComponent(project.titulo)}.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-cta"
                  onClick={onClose}
                >
                  <span>Iniciar conversa sobre um projeto assim</span>
                  <span>→</span>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
