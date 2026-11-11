// One-click payment review from the admin's email.
//
// The email buttons open a page (GET) that shows the payment and asks for confirmation; the actual
// approve/reject happens only on the POST from that page. Email security scanners (Gmail, Outlook)
// open links automatically, so a GET must never change anything.
import { Router, urlencoded } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { esc } from '../lib/email.js';
import { config } from '../config.js';
import { reviewPayment, verifyPaymentLinkToken, methodName } from '../jobs/payments.js';

const r = Router();
r.use(rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
r.use(urlencoded({ extended: false, limit: '10kb' }));

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} — JobRadar PK</title>
<style>
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f7f6f1;color:#0b1f17}
  .wrap{max-width:560px;margin:0 auto;padding:24px 16px}.card{background:#fff;border:1px solid #e3e1d8;border-radius:16px;padding:22px}
  h1{font-size:22px;margin:0 0 6px}.muted{color:#3d5248;font-size:14px}table{width:100%;border-collapse:collapse;margin:14px 0;font-size:15px}
  td{padding:7px 0;border-bottom:1px solid #f0eee6;vertical-align:top}td:first-child{color:#3d5248;width:40%}
  .btn{display:block;width:100%;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;margin-top:10px}
  .ok{background:#0d6b45;color:#fff}.no{background:#fff;color:#b91c1c;border:2px solid #b91c1c}
  textarea{width:100%;border:1px solid #e3e1d8;border-radius:12px;padding:10px;font:inherit;min-height:70px;margin-top:6px}
  img{max-width:100%;border-radius:12px;border:1px solid #e3e1d8;margin-top:10px}.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:600}
  .g{background:#e3f2ea;color:#08492f}.r{background:#fdecec;color:#b91c1c}.warn{background:#fff7e6;border-radius:12px;padding:10px 12px;font-size:14px;margin-top:12px}
  a{color:#0d6b45}
</style></head><body><div class="wrap"><p style="font-weight:800;margin:0 0 14px">JobRadar <span style="color:#0d6b45">PK</span> · Admin</p>${body}</div></body></html>`;

async function load(token) {
  const pid = verifyPaymentLinkToken(token);
  const { rows: [p] } = await query(
    `SELECT p.id, p.method, p.amount, p.txn_id, p.sender_number, p.status, p.admin_note, p.created_at, p.reviewed_at, u.email, u.name, u.paid_until
       FROM payments p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, [pid]);
  return p;
}

const invalid = (res) => res.status(400).type('html').send(page('Link expired', `<div class="card"><h1>This link is invalid or has expired</h1><p class="muted">Open the <a href="${esc(config.frontendUrl[0])}/admin?tab=payments">admin panel</a> to review payments.</p></div>`));

r.get('/payment', async (req, res) => {
  let p;
  try { p = await load(req.query.t); } catch { return invalid(res); }
  if (!p) return invalid(res);
  res.set('cache-control', 'no-store');
  const t = esc(req.query.t);
  const ref = p.method === 'bank' ? 'Reference' : 'TID';
  const details = `<table>
      <tr><td>User</td><td><b>${esc(p.name || '')}</b><br>${esc(p.email)}</td></tr>
      <tr><td>Method</td><td>${esc(methodName(p.method))}</td></tr>
      <tr><td>Amount</td><td><b>Rs ${Number(p.amount).toLocaleString()}</b></td></tr>
      <tr><td>${ref}</td><td><b style="font-family:monospace">${esc(p.txn_id)}</b></td></tr>
      <tr><td>${p.method === 'bank' ? 'Sender' : 'Paid from'}</td><td>${esc(p.sender_number || '')}</td></tr>
      <tr><td>Submitted</td><td>${esc(new Date(p.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }))}</td></tr>
    </table>
    <img src="payment/screenshot?t=${t}" alt="Payment screenshot">`;
  if (p.status !== 'pending') {
    return res.type('html').send(page('Already reviewed', `<div class="card"><h1>Already <span class="badge ${p.status === 'approved' ? 'g' : 'r'}">${esc(p.status)}</span></h1>
      <p class="muted">This payment was reviewed ${esc(new Date(p.reviewed_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }))}.${p.admin_note ? ` Note: ${esc(p.admin_note)}` : ''}</p>${details}</div>`));
  }
  const action = req.query.a === 'reject' ? 'reject' : 'approve';
  res.type('html').send(page('Review payment', `<div class="card">
    <h1>${action === 'approve' ? 'Approve this payment?' : 'Reject this payment?'}</h1>
    <p class="muted">Check that this ${ref.toLowerCase()} and amount appear in your ${p.method === 'bank' ? 'HBL statement' : `${esc(methodName(p.method))} app`} first.</p>
    ${details}
    <form method="post" action="payment">
      <input type="hidden" name="t" value="${t}">
      ${action === 'approve'
        ? `<button class="btn ok" name="a" value="approve">✅ Yes, approve & activate Pro</button>
           <p class="muted" style="text-align:center;margin-top:14px"><a href="payment?t=${t}&a=reject">Reject instead</a></p>`
        : `<label class="muted">Reason (sent to the user)</label><textarea name="note" maxlength="500" placeholder="e.g. TID not found in our account"></textarea>
           <button class="btn no" name="a" value="reject">❌ Reject payment</button>
           <p class="muted" style="text-align:center;margin-top:14px"><a href="payment?t=${t}">Approve instead</a></p>`}
    </form></div>`));
});

r.get('/payment/screenshot', async (req, res) => {
  let pid;
  try { pid = verifyPaymentLinkToken(req.query.t); } catch { return res.status(404).end(); }
  const { rows: [p] } = await query('SELECT screenshot, screenshot_mime FROM payments WHERE id = $1', [pid]);
  if (!p) return res.status(404).end();
  res.set({ 'content-type': p.screenshot_mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin' });
  res.send(p.screenshot);
});

r.post('/payment', async (req, res) => {
  let pid;
  try { pid = verifyPaymentLinkToken(req.body?.t); } catch { return invalid(res); }
  const action = req.body?.a === 'reject' ? 'reject' : req.body?.a === 'approve' ? 'approve' : null;
  if (!action) return invalid(res);
  const note = String(req.body?.note || '').trim().slice(0, 500) || undefined;
  // Attribute the action to the admin account the email was sent for
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const { rows: [admin] } = adminEmail ? await query(`SELECT id FROM users WHERE email = $1 AND role = 'admin'`, [adminEmail]) : { rows: [] };
  const done = await reviewPayment({ id: pid, action, note, adminId: admin?.id, via: 'email' });
  if (!done) return res.redirect(303, `payment?t=${encodeURIComponent(req.body.t)}`);
  const until = done.user.paid_until ? new Date(done.user.paid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  res.type('html').send(page('Done', `<div class="card"><h1>${action === 'approve' ? '✅ Approved' : '❌ Rejected'}</h1>
    <p class="muted">${action === 'approve' ? `Pro is active for ${esc(done.user.email)} until <b>${esc(until)}</b>.` : `${esc(done.user.email)} has been told the payment couldn't be verified.`} They have been emailed.</p>
    <p><a href="${esc(config.frontendUrl[0])}/admin?tab=payments">Open admin panel →</a></p></div>`));
});

export default r;
