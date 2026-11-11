import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;
if (config.smtp.host && config.smtp.user) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

export const emailEnabled = () => !!transporter;

export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[email disabled] would send to ${to}: ${subject}`);
    return false;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, html });
  return true;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderDigest({ name, closing, matches, appUrl }) {
  const row = (j, badge) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #eee">
      <a href="${esc(j.url)}" style="color:#0f5132;font-weight:600;text-decoration:none;font-size:15px">${esc(j.title)}</a>
      <div style="color:#555;font-size:13px">${esc(j.company || '')} · ${esc(j.location || (j.is_remote ? 'Remote' : ''))}</div>
      <div style="font-size:12px;margin-top:4px">${badge}</div>
    </td></tr>`;
  const closingRows = closing.map((j) => row(j, `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px">Closes ${esc(j.deadline)} (${j.days_left === 0 ? 'today' : j.days_left === 1 ? 'tomorrow' : `in ${j.days_left} days`})</span>`)).join('');
  const matchRows = matches.map((j) => row(j, `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px">${j.score}% match</span>`)).join('');
  return `
  <div style="font-family:system-ui,Segoe UI,Arial;max-width:600px;margin:auto;color:#111">
    <h2 style="margin-bottom:4px">JobRadar PK</h2>
    <p style="color:#555;margin-top:0">Assalam o Alaikum ${esc(name || '')}, here is your job update.</p>
    ${closing.length ? `<h3>⏰ Deadlines coming up</h3><table width="100%">${closingRows}</table>` : ''}
    ${matches.length ? `<h3>✨ New jobs matching your CV</h3><table width="100%">${matchRows}</table>` : ''}
    <p style="margin-top:24px"><a href="${esc(appUrl)}/dashboard" style="background:#0f5132;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open dashboard</a></p>
    <p style="color:#999;font-size:12px">You get this because email alerts are on. Turn them off in your profile.</p>
  </div>`;
}
