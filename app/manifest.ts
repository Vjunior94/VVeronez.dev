import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VVeronez.Dev — Dashboard',
    short_name: 'VVeronez',
    description: 'Dashboard de gestão de leads, propostas e projetos.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0a0814',
    theme_color: '#0a0814',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
