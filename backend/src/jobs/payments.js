// Shared payment review logic (used by the admin panel and the one-click email links).
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';
import { audit } from '../auth.js';
import { getSettings } from '../lib/settings.js';
import { sendMail, esc, layout } from '../lib/email.js';

const METHOD = { easypaisa: 'Easypaisa', jazzcash: 'JazzCash', bank: 'Bank transfer' };
export const methodName = (m) => METHOD[m] || m;

/** Approve or reject a pending payment. Returns { pay, user } or null if it was already reviewed. */
export async function reviewPayment({ id, action, note, days, adminId, via = 'panel' }) {
  const s = await getSettings();
  const grant = days || s.plan_days;
  // Only a pending payment can be reviewed — this single UPDATE prevents double-approving
  const { rows: [pay] } = await query(
    `UPDATE payments SET status = $2, admin_note = $3, days_granted = $4, reviewed_by = $5, reviewed_at = now()
      WHERE id = $1 AND status = 'pending' RETURNING id, user_id, method, amount, txn_id, status, admin_note, days_granted, created_at, reviewed_at`,
    [id, action === 'approve' ? 'approved' : 'rejected', note || null, action === 'approve' ? grant : null, adminId || null]);
  if (!pay) return null;

  let user;
  if (action === 'approve') {
    ({ rows: [user] } = await query(
      `UPDATE users SET paid_until = GREATEST(coalesce(paid_until, now()), now()) + ($2 || ' days')::interval WHERE id = $1 RETURNING *`,
      [pay.user_id, grant]));
  } else {
    ({ rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [pay.user_id]));
  }
  await audit(adminId, `payment.${action}`, `payment:${id}`, { user: pay.user_id, txn: pay.txn_id, days: grant, note, via });

  const appUrl = config.frontendUrl[0];
  const ref = pay.method === 'bank' ? 'reference' : 'TID';
  const until = user.paid_until ? new Date(user.paid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  sendMail({
    to: user.email,
    subject: action === 'approve' ? 'Payment approved: JobRadar Pro is active' : 'Your payment could not be verified',
    html: layout(action === 'approve'
      ? `<p>Assalam o Alaikum ${esc(user.name || '')},</p><p>Your payment (${ref} <b>${esc(pay.txn_id)}</b>, Rs ${pay.amount}) has been approved. CV matching, AI tools and job alerts are active until <b>${esc(until)}</b>.</p>
         <p><a href="${esc(appUrl)}/matches" style="background:#1f4e8c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">See my matches</a></p>`
      : `<p>Assalam o Alaikum ${esc(user.name || '')},</p><p>We couldn't verify your payment with ${ref} <b>${esc(pay.txn_id)}</b>.${note ? ` Reason: ${esc(note)}` : ''}</p>
         <p>You can submit it again with the correct details on the <a href="${esc(appUrl)}/billing">billing page</a>.</p>`),
  }).catch((e) => console.warn('[payment email]', e.message));

  return { pay, user };
}

// ── Signed links for the admin notification email ────────────────────────────
// A separate signing key from login tokens, so a payment link can never be used as a session.
const linkKey = () => `${config.jwtSecret}:payment-email-action`;

export function paymentLinkToken(paymentId) {
  return jwt.sign({ pid: paymentId, typ: 'pay-review' }, linkKey(), { expiresIn: '14d', algorithm: 'HS256' });
}

export function verifyPaymentLinkToken(token) {
  const d = jwt.verify(String(token || ''), linkKey(), { algorithms: ['HS256'] });
  if (d.typ !== 'pay-review' || !Number.isInteger(d.pid)) throw new Error('bad token');
  return d.pid;
}
