import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';

const APK_BUCKET = 'apks';
const MAX_APKS = 10;
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

export const runtime = 'nodejs';

async function authenticate(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  if (token.startsWith('tf_')) {
    const hash = createHash('sha256').update(token).digest('hex');
    const { data: pat } = await supabaseAdmin
      .from('personal_access_tokens')
      .select('id, user_id')
      .eq('token_hash', hash)
      .maybeSingle();
    if (!pat) return null;
    await supabaseAdmin
      .from('personal_access_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', pat.id);
    return pat.user_id as string;
  }

  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

async function canUpload(userId: string, projectId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return false;
  if ((profile.role as string) === 'super_admin') return true;

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();
  if (!project) return false;
  if (project.owner_id === userId) return true;

  const { data: member } = await supabaseAdmin
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return false;
  return ['developer', 'project_admin'].includes(member.role as string);
}

export async function POST(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized. Provide a valid personal access token.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = form.get('file');
  const projectId = String(form.get('projectId') ?? '');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.apk')) {
    return NextResponse.json({ error: 'Only .apk files are allowed' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 200 MB limit' }, { status: 413 });
  }
  if (!projectId) {
    return NextResponse.json({ error: 'Missing "projectId" field' }, { status: 400 });
  }

  if (!(await canUpload(userId, projectId))) {
    return NextResponse.json({ error: 'You are not allowed to upload APKs to this project' }, { status: 403 });
  }

  const storagePath = `${projectId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(APK_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.android.package-archive',
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('project_apks')
    .insert({
      project_id: projectId,
      uploaded_by: userId,
      file_name: file.name,
      size_bytes: file.size,
      storage_path: storagePath,
    })
    .select('*')
    .single();

  if (insertError) {
    await supabaseAdmin.storage.from(APK_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Retention: keep only MAX_APKS newest per project
  const { data: stale } = await supabaseAdmin
    .from('project_apks')
    .select('id, storage_path')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .range(MAX_APKS, MAX_APKS + 99);
  if (stale && stale.length > 0) {
    await supabaseAdmin.storage.from(APK_BUCKET).remove(stale.map((s) => s.storage_path));
    await supabaseAdmin.from('project_apks').delete().in('id', stale.map((s) => s.id));
  }

  const { data: urlData } = supabaseAdmin.storage.from(APK_BUCKET).getPublicUrl(storagePath);
  const { data: projectRow } = await supabaseAdmin
    .from('projects')
    .select('slug')
    .eq('id', projectId)
    .maybeSingle();

  return NextResponse.json({
    apk: inserted,
    url: urlData.publicUrl,
    shareUrl: projectRow
      ? `${req.nextUrl.origin}/apk/${projectRow.slug}/${inserted.number}`
      : urlData.publicUrl,
    message: 'APK uploaded successfully',
  });
}
