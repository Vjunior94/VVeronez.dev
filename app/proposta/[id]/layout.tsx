import type { Metadata } from 'next';

const ogImageUrl = 'https://vveronez.dev/api/og-proposta';

export const metadata: Metadata = {
  title: 'Sua Proposta — VVeronez.Dev',
  description: 'Proposta técnica preparada exclusivamente para você. Use a senha enviada para acessar.',
  openGraph: {
    title: 'Acesse sua proposta — VVeronez.Dev',
    description: 'Proposta técnica preparada exclusivamente para você.',
    type: 'website',
    siteName: 'VVeronez.Dev',
    images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Proposta VVeronez.Dev' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acesse sua proposta — VVeronez.Dev',
    description: 'Proposta técnica preparada exclusivamente para você.',
    images: [ogImageUrl],
  },
};

export default function PropostaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
