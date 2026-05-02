import { NextResponse } from 'next/server';

// Placeholder — webhook do WhatsApp continua apontando pro backend Sofia atual.
// Esta rota será ativada no deploy (Fase 3), quando migrarmos o webhook pra cá.
export async function POST() {
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ status: 'webhook ready' });
}
