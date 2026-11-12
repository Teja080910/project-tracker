import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4105';
const FILES_ROOT = (process.env.NEXT_PUBLIC_FILES_ROOT ?? process.env.NEXT_PUBLIC_FILES_URL ?? '').replace(/\/[^/]+$/, '');

export const runtime = 'nodejs';

type ApiError = { error?: { message?: string } };
type Profile = { id: string; role: string; disabled: boolean };
type Project = {
  id: string;
  slug: string;
  ownerId: string;
  members?: Array<{ userId: string; role: string; profile?: Profile }>;
};

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: T & ApiError }> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
  const body = (await response.json().catch(() => ({}))) as T & ApiError;
  return { ok: response.ok, status: response.status, body };
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized. Sign in first.' }, { status: 401 });
  }

  const me = await api<Profile>('/api/pt/me', token);
  if (!me.ok || !me.body?.id) {
    return NextResponse.json({ error: 'Unauthorized. Sign in first.' }, { status: 401 });
  }
  if (me.body.disabled) {
    return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
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
  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 200 MB limit' }, { status: 413 });
  }
  if (!projectId) {
    return NextResponse.json({ error: 'Missing "projectId" field' }, { status: 400 });
  }

  const projectRes = await api<Project>(`/api/pt/projects/${encodeURIComponent(projectId)}`, token);
  if (!projectRes.ok || !projectRes.body?.id) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  const project = projectRes.body;
  const member = project.members?.find((row) => row.userId === me.body.id);
  const allowed =
    ['super_admin', 'admin'].includes(me.body.role) ||
    project.ownerId === me.body.id ||
    (member ? ['developer', 'project_admin'].includes(member.role) : false);
  if (!allowed) {
    return NextResponse.json({ error: 'You are not allowed to upload APKs to this project' }, { status: 403 });
  }

  const presign = await api<{ uploadUrl: string; objectKey: string; headers: Record<string, string> }>(
    '/api/pt/uploads/presign',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ bucket: 'apks', projectId, fileName: file.name, contentType: 'application/vnd.android.package-archive' }),
    },
  );
  if (!presign.ok) {
    return NextResponse.json({ error: presign.body?.error?.message ?? 'Could not prepare upload' }, { status: 500 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const put = await fetch(presign.body.uploadUrl, {
    method: 'PUT',
    headers: { ...presign.body.headers, 'content-type': 'application/vnd.android.package-archive' },
    body: buffer,
  });
  if (!put.ok) {
    return NextResponse.json({ error: 'Could not upload APK' }, { status: 500 });
  }

  const registered = await api<{ id: string; number: number; fileName: string; storagePath: string }>(
    `/api/pt/projects/${encodeURIComponent(projectId)}/apks`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        sizeBytes: file.size,
        storagePath: presign.body.objectKey,
      }),
    },
  );
  if (!registered.ok) {
    return NextResponse.json({ error: registered.body?.error?.message ?? 'Could not save APK' }, { status: 500 });
  }

  const publicUrl = `${FILES_ROOT}/pt-apks/${presign.body.objectKey.split('/').map(encodeURIComponent).join('/')}`;
  return NextResponse.json({
    apk: registered.body,
    url: publicUrl,
    shareUrl: `${req.nextUrl.origin}/apk/${project.slug}/${registered.body.number}/${encodeURIComponent(file.name)}`,
    message: 'APK uploaded successfully',
  });
}
