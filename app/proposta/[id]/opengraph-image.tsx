import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Proposta VVeronez.Dev';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
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
        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(ellipse, rgba(200,130,107,0.15) 0%, transparent 65%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-15%',
            left: '-5%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(ellipse, rgba(200,131,154,0.1) 0%, transparent 65%)',
            borderRadius: '50%',
          }}
        />

        {/* Top line accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #c8826b, #c8839a, transparent)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#f0e6dc',
            marginBottom: '48px',
            display: 'flex',
          }}
        >
          <span>VV</span>
          <span style={{ color: '#c8826b' }}>eronez</span>
          <span>.dev</span>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div style={{ width: '40px', height: '1px', background: '#c8826b' }} />
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.25em',
              textTransform: 'uppercase' as const,
              color: '#c8826b',
            }}
          >
            Proposta exclusiva
          </div>
          <div style={{ width: '40px', height: '1px', background: '#c8826b' }} />
        </div>

        {/* Main text */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 400,
            color: '#f0e6dc',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: '800px',
            marginBottom: '32px',
          }}
        >
          Acesse sua proposta
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '18px',
            color: '#8a8494',
            textAlign: 'center',
            maxWidth: '500px',
            lineHeight: 1.6,
          }}
        >
          Preparada exclusivamente para você.
          <br />
          Use a senha enviada para acessar.
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase' as const,
              color: '#6a6470',
            }}
          >
            Proposta confidencial
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
