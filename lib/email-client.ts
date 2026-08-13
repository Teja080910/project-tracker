export async function sendNotificationEmail(to: string, title: string, body: string, link: string) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, title, body, link }),
    });
    if (!res.ok) {
      console.warn('Email API returned', res.status);
    }
  } catch (err) {
    console.warn('Email send failed:', err);
  }
}
