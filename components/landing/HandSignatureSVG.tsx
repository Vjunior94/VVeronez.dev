'use client';

import { useEffect, useState } from 'react';

interface Props {
  className?: string;
  ariaHidden?: boolean;
}

// Cache global da SVG entre instâncias (evita 2 fetches: 1 pra base, 1 pra shimmer)
let svgCache: string | null = null;
let svgPromise: Promise<string> | null = null;

async function loadSignature(): Promise<string> {
  if (svgCache) return svgCache;
  if (svgPromise) return svgPromise;

  svgPromise = fetch('/signatures/signature-no-v.svg')
    .then((r) => r.text())
    .then((text) => {
      // Extrai conteúdo interno do <svg> pra envolver com nossa wrapper SVG
      const match = text.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
      const inner = match ? match[1] : text;
      svgCache = inner;
      return inner;
    })
    .catch(() => {
      svgCache = '';
      return '';
    });

  return svgPromise;
}

export default function HandSignatureSVG({ className = 'hand-signature-svg', ariaHidden = false }: Props) {
  const [innerHtml, setInnerHtml] = useState<string>('');

  useEffect(() => {
    loadSignature().then(setInnerHtml);
  }, []);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="199.2 134.1 1386.7 310.4"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden={ariaHidden}
      {...(ariaHidden ? {} : { 'aria-label': 'Assinatura Valmir Veronez' })}
      dangerouslySetInnerHTML={{ __html: innerHtml }}
    />
  );
}