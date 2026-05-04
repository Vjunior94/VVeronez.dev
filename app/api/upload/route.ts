import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const path = formData.get('path') as string | null;

  if (!file || !path) {
    return NextResponse.json({ error: 'file and path required' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('public-assets')
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
