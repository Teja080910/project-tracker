import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4105';
const FILES_ROOT = (process.env.NEXT_PUBLIC_FILES_ROOT ?? process.env.NEXT_PUBLIC_FILES_URL ?? '').replace(/\/[^/]+$/, '');

export const runtime = 'nodejs';

type ApkLookup = {
  apk?: { storagePath?: string; storage_path?: string; fileName?: string; file_name?: string };
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectSlug: string; rest?: string[] } },
) {
  const segments = (params.rest || []).map((segment) => decodeURIComponent(segment));
  if (segments.length === 0) {
    return NextResponse.json({ error: 'Invalid APK path' }, { status: 400 });
  }

  const identifier = /^\d+$/.test(segments[0]!)
    ? segments[0]!
    : segments.join('/');

  const response = await fetch(
    `${API_URL}/api/public/pt/apk/${encodeURIComponent(params.projectSlug)}/${encodeURIComponent(identifier)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) {
    return NextResponse.json({ error: 'APK not found' }, { status: response.status === 404 ? 404 : 502 });
  }

  const body = (await response.json().catch(() => null)) as ApkLookup | null;
  const storagePath = body?.apk?.storagePath ?? body?.apk?.storage_path;
  if (!storagePath) {
    return NextResponse.json({ error: 'APK not found' }, { status: 404 });
  }

  const location = `${FILES_ROOT}/pt-apks/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
  return NextResponse.redirect(location, 302);
}
