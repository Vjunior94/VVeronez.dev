import { NextResponse } from 'next/server';

// Placeholder — geração de propostas será integrada com Claude na Fase 2.5
export async function POST() {
  return NextResponse.json({ message: 'Geração de propostas ainda não implementada' }, { status: 501 });
}
