import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectSlug: string; rest?: string[] } }
) {
  const segments = (params.rest || []).map((s) => decodeURIComponent(s));
  if (segments.length === 0) {
    return NextResponse.json({ error: 'Invalid APK path' }, { status: 400 });
  }

  let number: number | null = null;
  let fileName: string | null = null;

  if (/^\d+$/.test(segments[0])) {
    number = parseInt(segments[0], 10);
    // Optional trailing filename segment is accepted but ignored for lookup
    fileName = segments.length > 1 ? segments.slice(1).join('/') : null;
  } else {
    fileName = segments.join('/');
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('slug', params.projectSlug)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let query = supabaseAdmin
    .from('project_apks')
    .select('number, file_name, storage_path')
    .eq('project_id', project.id);

  if (number !== null) {
    query = query.eq('number', number);
  } else if (fileName) {
    query = query.eq('file_name', fileName).order('created_at', { ascending: false }).limit(1);
  } else {
    return NextResponse.json({ error: 'Invalid APK path' }, { status: 400 });
  }

  const { data: apk } = await query.maybeSingle();
  if (!apk) {
    return NextResponse.json({ error: 'APK not found' }, { status: 404 });
  }

  const { data } = supabaseAdmin.storage.from('apks').getPublicUrl(apk.storage_path);
  return NextResponse.redirect(data.publicUrl, 302);
}
