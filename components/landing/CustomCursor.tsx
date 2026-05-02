'use client';

import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasHover = window.matchMedia('(hover: hover)').matches;
    if (!hasHover) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = 0, my = 0, rx = 0, ry = 0;
    let hasFirstMove = false;

    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.left = mx + 'px';
      dot.style.top = my + 'px';

      // No primeiro movimento, revela os elementos
      if (!hasFirstMove) {
        hasFirstMove = true;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      }
    };

    let animId: number;
    const animateRing = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      ring.style.transform = `translate(-50%, -50%) ${ring.classList.contains('expand') ? 'scale(1.8)' : 'scale(1)'}`;
      animId = requestAnimationFrame(animateRing);
    };

    document.addEventListener('mousemove', onMouseMove);
    animId = requestAnimationFrame(animateRing);

    const expandTargets = 'a, button, .hero-case, .case-card, input, textarea';
    const onEnter = () => ring.classList.add('expand');
    const onLeave = () => ring.classList.remove('expand');

    const observer = new MutationObserver(() => {
      document.querySelectorAll(expandTargets).forEach((el) => {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onLeave);
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.querySelectorAll(expandTargets).forEach((el) => {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onLeave);
    });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div className="cursor-dot" ref={dotRef} style={{ opacity: 0, transition: 'opacity 0.2s' }} />
      <div className="cursor-ring" ref={ringRef} style={{ opacity: 0, transition: 'opacity 0.2s' }} />
    </>
  );
}