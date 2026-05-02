# VVeronez.Dev

Plataforma pessoal de Valmir Veronez — engenharia de software boutique premium.

## Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS 4
- React 19
- Three.js (V 3D animado + hero gradient mesh shader)

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Estrutura de pastas

```
app/
  (public)/         Landing page publica
  layout.tsx        Root layout (fonts, metadata)
  globals.css       Variaveis CSS + estilos da landing
components/
  landing/          Componentes da landing page
  shared/           Componentes compartilhados (futuro)
lib/
  projects-data.ts  Dados dos 7 projetos
public/
  signatures/       SVG da assinatura manuscrita
```

## Status

Fase 1/3 — Landing page portada do HTML de referencia.
