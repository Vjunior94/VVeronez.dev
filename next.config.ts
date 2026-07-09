import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Rotas legadas → novas. Server-side (308), substituem as páginas de
    // redirect client-side que existiam em app/(admin)/{sofia,pipeline,agenor}.
    return [
      { source: '/sofia', destination: '/leads', permanent: true },
      { source: '/sofia/novo', destination: '/leads/novo', permanent: true },
      { source: '/sofia/:id', destination: '/leads/:id', permanent: true },
      { source: '/pipeline', destination: '/leads', permanent: true },
      { source: '/agenor', destination: '/propostas', permanent: true },
    ];
  },
};

export default nextConfig;
