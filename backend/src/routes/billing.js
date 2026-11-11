// Manual Easypaisa / JazzCash payments: the user pays to the admin's account, then submits the
// transaction ID + a screenshot. The admin is emailed and approves or rejects it in the admin panel.
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { getSettings, publicSettings } from '../lib/settings.js';
import { notifyAdmin, esc, layout } from '../lib/email.js';
import { config } from '../config.js';
import { paymentLinkToken } from '../jobs/payments.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 10 } });
const submitLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, keyGenerator: (req) => `u${req.user?.id}`, message: { error: 'Too many payment submissions. Try again later.' } });

/** Identify the image by its bytes, not by the file name/extension the browser claims. */
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

r.get('/plan', async (_req, res) => res.json(publicSettings(await getSettings())));

r.get('/payments', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, method, amount, txn_id, sender_number, status, admin_note, days_granted, created_at, reviewed_at
       FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
  res.json({ payments: rows });
});

const METHOD_NAMES = { easypaisa: 'Easypaisa', jazzcash: 'JazzCash', bank: 'Bank transfer' };
const wallet = z.object({
  method: z.enum(['easypaisa', 'jazzcash']),
  txn_id: z.string().trim().regex(/^[A-Za-z0-9-]{6,32}$/, 'Enter the Transaction ID / TID exactly as shown in your receipt'),
  sender_number: z.string().trim().regex(/^(\+92|0)3\d{9}$/, 'Enter the mobile number you paid from, e.g. 03001234567'),
});
const bank = z.object({
  method: z.literal('bank'),
  txn_id: z.string().trim().regex(/^[A-Za-z0-9-]{4,40}$/, 'Enter the transaction reference / STAN number from your bank receipt'),
  sender_number: z.string().trim().min(3, 'Enter the name or account you paid from').max(60).regex(/^[\p{L}\p{N} .,'()-]+$/u, 'Use letters and numbers only'),
});
const form = z.discriminatedUnion('method', [wallet, bank]);

r.post('/payments', requireAuth, submitLimiter, upload.single('screenshot'), async (req, res) => {
  const p = form.safeParse(req.body || {});
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const mime = sniffImage(req.file?.buffer);
  if (!mime) return res.status(400).json({ error: 'Attach a screenshot of the payment (PNG, JPG or WEBP, max 4 MB)' });

  const s = await getSettings();
  if (s.global_free) return res.status(400).json({ error: 'CV matching is free for everyone right now — no payment needed.' });
  const pending = await query(`SELECT 1 FROM payments WHERE user_id = $1 AND status = 'pending'`, [req.user.id]);
  if (pending.rowCount) return res.status(409).json({ error: 'You already have a payment waiting for review. We will email you once it is checked.' });

  let row;
  try {
    ({ rows: [row] } = await query(
      `INSERT INTO payments (user_id, method, amount, txn_id, sender_number, screenshot, screenshot_mime)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, method, amount, txn_id, status, created_at`,
      [req.user.id, p.data.method, s.price_pkr, p.data.txn_id.toUpperCase(), p.data.sender_number, req.file.buffer, mime]
    ));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'This transaction ID has already been submitted.' });
    throw e;
  }

  const appUrl = config.frontendUrl[0];
  const link = `${config.publicApiUrl}/email-actions/payment?t=${paymentLinkToken(row.id)}`;
  const methodName = METHOD_NAMES[p.data.method];
  notifyAdmin(
    `💰 New ${methodName} payment — Rs ${s.price_pkr} from ${req.user.email}`,
    layout(`
      <p>A user submitted a payment for review.</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#555">User</td><td><b>${esc(req.user.name || '')}</b> ${esc(req.user.email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555">Method</td><td>${methodName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555">Amount</td><td>Rs ${s.price_pkr}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555">Transaction ID</td><td><b>${esc(row.txn_id)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#555">${p.data.method === 'bank' ? 'Sender' : 'Paid from'}</td><td>${esc(p.data.sender_number)}</td></tr>
      </table>
      <p>Check that this ${p.data.method === 'bank' ? 'reference' : 'TID'} and amount appear in your ${p.data.method === 'bank' ? 'HBL account statement' : `${methodName} app`} before approving. The screenshot is attached.</p>
      <table cellpadding="0" cellspacing="0" style="margin:18px 0"><tr>
        <td style="padding-right:10px"><a href="${esc(link)}&a=approve" style="display:inline-block;background:#0f5132;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">✅ Approve</a></td>
        <td><a href="${esc(link)}&a=reject" style="display:inline-block;background:#fff;color:#b91c1c;border:2px solid #b91c1c;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700">❌ Reject</a></td>
      </tr></table>
      <p style="font-size:13px;color:#555">Each button opens a confirmation page — nothing changes until you confirm there. Links work for 14 days. You can also review it in the <a href="${esc(appUrl)}/admin?tab=payments">admin panel</a>.</p>`),
    [{ filename: `payment-${row.id}.${mime.split('/')[1]}`, content: req.file.buffer }]
  ).catch(() => {});

  res.json({ payment: row });
});

export default r;
