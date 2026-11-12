import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4105';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { email, password, full_name, role } = (body ?? {}) as Record<string, unknown>;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const response = await fetch(`${API_URL}/api/pt/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      email,
      password,
      fullName: full_name || String(email).split('@')[0],
      role: role || 'viewer',
    }),
  });
  const result = (await response.json().catch(() => null)) as
    | { id?: string; email?: string; error?: { message?: string } }
    | null;

  if (!response.ok) {
    return NextResponse.json(
      { error: result?.error?.message ?? 'Could not create user' },
      { status: response.status },
    );
  }
  return NextResponse.json({ user: result });
}
