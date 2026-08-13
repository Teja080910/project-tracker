import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, notificationEmailHtml } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { to, title, body, link } = await req.json();
    if (!to || !title) {
      return NextResponse.json({ error: 'Missing to or title' }, { status: 400 });
    }
    const result = await sendEmail(to, title, notificationEmailHtml(title, body ?? '', link ?? ''));
    return NextResponse.json(result);
  } catch (err) {
    console.error('Email API error:', err);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }
}
