import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d0c14 0%, #161424 50%, #1e1b2e 100%)',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow effects */}
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '600px', height: '600px', background: 'radial-gradient(ellipse, rgba(200,130,107,0.15) 0%, transparent 65%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-5%', width: '400px', height: '400px', background: 'radial-gradient(ellipse, rgba(200,131,154,0.1) 0%, transparent 65%)', borderRadius: '50%' }} />

        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #c8826b, #c8839a, transparent)' }} />

        {/* Logo */}
        <div style={{ fontSize: '28px', fontWeight: 700, color: '#f0e6dc', marginBottom: '48px', display: 'flex' }}>
          <span>VV</span>
          <span style={{ color: '#c8826b' }}>eronez</span>
          <span>.dev</span>
        </div>

        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '40px', height: '1px', background: '#c8826b' }} />
          <div style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '0.25em', color: '#c8826b' }}>PROPOSTA EXCLUSIVA</div>
          <div style={{ width: '40px', height: '1px', background: '#c8826b' }} />
        </div>

        {/* Main text */}
        <div style={{ fontSize: '56px', fontWeight: 400, color: '#f0e6dc', textAlign: 'center', lineHeight: 1.2, maxWidth: '800px', marginBottom: '32px' }}>
          Acesse sua proposta
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: '18px', color: '#8a8494', textAlign: 'center', maxWidth: '500px', lineHeight: 1.6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span>Preparada exclusivamente para você.</span>
          <span>Use a senha enviada para acessar.</span>
        </div>

        {/* Bottom */}
        <div style={{ position: 'absolute', bottom: '40px', fontSize: '12px', letterSpacing: '0.15em', color: '#6a6470' }}>
          PROPOSTA CONFIDENCIAL
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
