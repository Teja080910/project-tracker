import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/server';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:no-reply@example.com';

let vapidConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
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

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: caller } = await supabaseAdmin
      .from('profiles')
      .select('disabled')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (caller?.disabled) {
      return NextResponse.json({ error: 'Account disabled' }, { status: 403 });
    }

    const { userId, title, body, link } = await req.json();
    if (!userId || !title) {
      return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 });
    }

    const { data: subscriptions } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, removed: 0 });
    }

    const payload = JSON.stringify({
      title,
      body: body ?? '',
      link: link ?? '/app',
      icon: '/logo.jpg',
    });

    let sent = 0;
    let removed = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent += 1;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
            removed += 1;
          } else {
            console.error('Push send failed:', statusCode, err instanceof Error ? err.message : err);
          }
        }
      })
    );

    return NextResponse.json({ sent, removed });
  } catch (err) {
    console.error('Push API error:', err);
    return NextResponse.json({ error: 'Push send failed' }, { status: 500 });
  }
}
