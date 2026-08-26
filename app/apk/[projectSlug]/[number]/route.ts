import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectSlug: string; number: string } }
) {
  const projectSlug = params.projectSlug;
  const number = parseInt(params.number, 10);
  if (!Number.isFinite(number)) {
    return NextResponse.json({ error: 'Invalid APK number' }, { status: 400 });
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('slug', projectSlug)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: apk } = await supabaseAdmin
    .from('project_apks')
    .select('storage_path')
    .eq('project_id', project.id)
    .eq('number', number)
    .maybeSingle();
  if (!apk) {
    return NextResponse.json({ error: 'APK not found' }, { status: 404 });
  }

  const { data } = supabaseAdmin.storage.from('apks').getPublicUrl(apk.storage_path);
  return NextResponse.redirect(data.publicUrl, 302);
}
