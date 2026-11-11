// Email: Resend (HTTPS API) when a Resend key is set in admin settings or RESEND_API_KEY, otherwise SMTP.
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { getSettings } from './settings.js';

let smtp = null;
if (config.smtp.host && config.smtp.user) {
  smtp = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

async function emailConfig() {
  const s = await getSettings();
  return {
    resendKey: s.email.resendApiKey || process.env.RESEND_API_KEY || '',
    from: s.email.from || process.env.MAIL_FROM || config.smtp.from,
    adminNotify: s.email.adminNotify || process.env.ADMIN_NOTIFY_EMAIL || '',
  };
}

export async function emailEnabled() {
  const c = await emailConfig();
  return !!(c.resendKey || smtp);
}

/** attachments: [{ filename, content: Buffer }] */
export async function sendMail({ to, subject, html, attachments = [] }) {
  const c = await emailConfig();
  if (c.resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${c.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: c.from || 'JobRadar PK <onboarding@resend.dev>', to: [].concat(to), subject, html,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return true;
  }
  if (smtp) {
    await smtp.sendMail({ from: c.from, to, subject, html, attachments });
    return true;
  }
  console.log(`[email disabled] would send to ${to}: ${subject}`);
  return false;
}

export async function notifyAdmin(subject, html, attachments) {
  const c = await emailConfig();
  if (!c.adminNotify) { console.log(`[admin notify] no ADMIN_NOTIFY_EMAIL set: ${subject}`); return false; }
  try { return await sendMail({ to: c.adminNotify, subject, html, attachments }); }
  catch (e) { console.error('[admin notify] failed:', e.message); return false; }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const layout = (body, appUrl) => `
  <div style="font-family:system-ui,Segoe UI,Arial;max-width:600px;margin:auto;color:#111">
    <h2 style="margin-bottom:4px">JobRadar PK</h2>
    ${body}
    ${appUrl ? `<p style="color:#999;font-size:12px;margin-top:28px">${esc(appUrl)}</p>` : ''}
  </div>`;

export function renderDigest({ name, closing, matches, appUrl }) {
  const row = (j, badge) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #eee">
      <a href="${esc(j.url)}" style="color:#0f5132;font-weight:600;text-decoration:none;font-size:15px">${esc(j.title)}</a>
      <div style="color:#555;font-size:13px">${esc(j.company || '')} · ${esc(j.location || (j.is_remote ? 'Remote' : ''))}</div>
      <div style="font-size:12px;margin-top:4px">${badge}</div>
    </td></tr>`;
  const closingRows = closing.map((j) => row(j, `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px">Closes ${esc(j.deadline)} (${j.days_left === 0 ? 'today' : j.days_left === 1 ? 'tomorrow' : `in ${j.days_left} days`})</span>`)).join('');
  const matchRows = matches.map((j) => row(j, `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px">${j.score}% match</span>`)).join('');
  return layout(`
    <p style="color:#555;margin-top:0">Assalam o Alaikum ${esc(name || '')}, here is your job update.</p>
    ${closing.length ? `<h3>⏰ Deadlines coming up</h3><table width="100%">${closingRows}</table>` : ''}
    ${matches.length ? `<h3>✨ New jobs matching your CV</h3><table width="100%">${matchRows}</table>` : ''}
    <p style="margin-top:24px"><a href="${esc(appUrl)}/matches" style="background:#0f5132;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open dashboard</a></p>
    <p style="color:#999;font-size:12px">You get this because email alerts are on. Turn them off in your profile.</p>`);
}
