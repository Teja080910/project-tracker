import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4105';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:no-reply@example.com';

let vapidConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

async function api<T>(path: string, token: string): Promise<{ ok: boolean; body: T }> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, body };
}

export async function POST(req: NextRequest) {
  try {
    if (!vapidConfigured) {
      return NextResponse.json({ error: 'Push is not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const me = await api<{ id?: string; disabled?: boolean }>('/api/pt/me', token);
    if (!me.ok || !me.body.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (me.body.disabled) {
      return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
    }

    const { userId, title, body, link } = await req.json();
    if (!userId || !title) {
      return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 });
    }

    const subscriptions = await api<{ subscriptions?: Subscription[] }>(
      `/api/pt/push/subscriptions/${encodeURIComponent(userId)}`,
      token,
    );
    if (!subscriptions.ok) {
      return NextResponse.json({ error: 'Not allowed to notify this user' }, { status: 403 });
    }

    const payload = JSON.stringify({
      title,
      body: body ?? '',
      link: link ?? '/app',
      icon: '/logo.jpg',
    });

    let sent = 0;
    let failed = 0;
    await Promise.all(
      (subscriptions.body.subscriptions ?? []).map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
          );
          sent += 1;
        } catch {
          failed += 1;
        }
      }),
    );

    return NextResponse.json({ sent, failed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Push failed' },
      { status: 500 },
    );
  }
}
