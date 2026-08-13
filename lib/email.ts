import nodemailer from 'nodemailer';
import { APP_NAME } from '@/lib/app-config';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) {
    console.warn('SMTP not configured — skipping email to', to);
    return { skipped: true };
  }
  try {
    const info = await t.sendMail({
      from: `"${APP_NAME}" <${SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent to', to, '| id:', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send failed:', err);
    return { ok: false, error: err };
  }
}

export function notificationEmailHtml(title: string, body: string, link: string) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="margin:0 0 8px;color:#111827">${title}</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6">${body}</p>
    <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">View in ${APP_NAME}</a>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">You received this because of activity in ${APP_NAME}.</p>
  </div>`;
}
