import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sua Proposta — VVeronez.Dev',
  description: 'Proposta técnica preparada exclusivamente para você. Use a senha enviada para acessar.',
  openGraph: {
    title: 'Acesse sua proposta — VVeronez.Dev',
    description: 'Proposta técnica preparada exclusivamente para você.',
    type: 'website',
    siteName: 'VVeronez.Dev',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acesse sua proposta — VVeronez.Dev',
    description: 'Proposta técnica preparada exclusivamente para você.',
  },
};

export default function PropostaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
