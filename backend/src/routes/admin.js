// Admin API. Every route requires an admin session (role = 'admin') or the ADMIN_KEY header.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAdmin, audit, userView } from '../auth.js';
import { getSettings, setSetting, maskedSettings, DEFAULTS } from '../lib/settings.js';
import { sendMail, esc, layout, emailEnabled } from '../lib/email.js';
import { testAI, aiAvailable, aiStatus } from '../lib/ai.js';
import { runIngest } from '../jobs/ingest.js';
import { runReminders } from '../jobs/reminders.js';
import { plannedSearches, creditsUsed } from '../sources/jsearch.js';
import { ALL_SOURCES } from '../sources/index.js';
import { config } from '../config.js';

const r = Router();
r.use(requireAdmin);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const adminId = (req) => req.user?.id || null;

// ── Overview ─────────────────────────────────────────────────────────────────
r.get('/overview', wrap(async (_req, res) => {
  const { rows: [u] } = await query(`SELECT
      count(*)::int AS users,
      count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS new_week,
      count(*) FILTER (WHERE paid_until > now())::int AS paying,
      count(*) FILTER (WHERE is_free)::int AS free_users,
      count(*) FILTER (WHERE cv_text IS NOT NULL)::int AS with_cv,
      count(*) FILTER (WHERE disabled)::int AS disabled
    FROM users`);
  const { rows: [p] } = await query(`SELECT
      count(*) FILTER (WHERE status = 'pending')::int AS pending,
      coalesce(sum(amount) FILTER (WHERE status = 'approved' AND reviewed_at >= date_trunc('month', now())), 0)::int AS revenue_month,
      coalesce(sum(amount) FILTER (WHERE status = 'approved'), 0)::int AS revenue_total
    FROM payments`);
  const { rows: [j] } = await query(`SELECT count(*)::int AS jobs, count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS jobs_today FROM jobs`);
  const s = await getSettings();
  res.json({
    users: u, payments: p, jobs: j, global_free: s.global_free,
    ai: await aiAvailable(), email: await emailEnabled(), jsearch: await creditsUsed(),
  });
}));

// ── Users ────────────────────────────────────────────────────────────────────
r.get('/users', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const filter = String(req.query.filter || '');
  const where = [];
  const params = [];
  if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(lower(email) LIKE $${params.length} OR lower(coalesce(name,'')) LIKE $${params.length})`); }
  if (filter === 'paying') where.push('paid_until > now()');
  if (filter === 'free') where.push('is_free');
  if (filter === 'admins') where.push(`role = 'admin'`);
  if (filter === 'disabled') where.push('disabled');
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, email, name, role, is_free, paid_until, disabled, email_alerts, google_uid IS NOT NULL AS google,
            cv_text IS NOT NULL AS has_cv, skills, titles, created_at, last_login
       FROM users ${w} ORDER BY created_at DESC LIMIT 50 OFFSET ${(page - 1) * 50}`, params);
  const { rows: [{ count }] } = await query(`SELECT count(*)::int FROM users ${w}`, params);
  res.json({ users: rows, total: count, page });
}));

const userPatch = z.object({
  name: z.string().trim().max(100).nullable().optional(),
  is_free: z.boolean().optional(),
  disabled: z.boolean().optional(),
  role: z.enum(['user', 'admin']).optional(),
  email_alerts: z.boolean().optional(),
  paid_until: z.string().datetime({ offset: true }).nullable().optional(),
  extend_days: z.number().int().min(-365).max(3650).optional(),
  skills: z.array(z.string().max(60)).max(80).optional(),
  titles: z.array(z.string().max(100)).max(10).optional(),
  logout_everywhere: z.boolean().optional(),
}).strict();

r.patch('/users/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const p = userPatch.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const d = p.data;
  if (id === adminId(req) && (d.disabled === true || d.role === 'user')) return res.status(400).json({ error: 'You cannot disable or demote your own admin account' });

  const sets = [];
  const vals = [id];
  const add = (sql, v) => { vals.push(v); sets.push(sql.replace('?', `$${vals.length}`)); };
  for (const k of ['name', 'is_free', 'disabled', 'role', 'email_alerts', 'skills', 'titles']) if (k in d) add(`${k} = ?`, d[k]);
  if ('paid_until' in d) add('paid_until = ?', d.paid_until);
  if (d.extend_days) add(`paid_until = GREATEST(coalesce(paid_until, now()), now()) + (? || ' days')::interval`, d.extend_days);
  if (d.disabled === true || d.role || d.logout_everywhere) sets.push('token_version = token_version + 1'); // force re-login
  if (!sets.length) return res.status(400).json({ error: 'Nothing to change' });
  const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  await audit(adminId(req), 'user.update', `user:${id}`, d);
  res.json({ user: await userView(rows[0]) });
}));

r.delete('/users/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === adminId(req)) return res.status(400).json({ error: 'You cannot delete your own account' });
  const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING email', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  await audit(adminId(req), 'user.delete', `user:${id}`, { email: rows[0].email });
  res.json({ ok: true });
}));

// ── Payments ─────────────────────────────────────────────────────────────────
r.get('/payments', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
  const { rows } = await query(
    `SELECT p.id, p.method, p.amount, p.txn_id, p.sender_number, p.status, p.admin_note, p.days_granted, p.created_at, p.reviewed_at,
            u.id AS user_id, u.email, u.name, u.paid_until,
            (SELECT count(*)::int FROM payments x WHERE x.user_id = u.id AND x.status = 'approved') AS approved_before
       FROM payments p JOIN users u ON u.id = p.user_id
      ${status ? 'WHERE p.status = $1' : ''} ORDER BY p.created_at DESC LIMIT 100`, status ? [status] : []);
  res.json({ payments: rows });
}));

// Screenshot is only ever served here, to admins, with a fixed safe content type.
r.get('/payments/:id/screenshot', wrap(async (req, res) => {
  const { rows } = await query('SELECT screenshot, screenshot_mime FROM payments WHERE id = $1', [Number(req.params.id)]);
  if (!rows[0]) return res.status(404).end();
  res.set({ 'content-type': rows[0].screenshot_mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' });
  res.send(rows[0].screenshot);
}));

const review = z.object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(500).optional(), days: z.number().int().min(1).max(3650).optional() });

r.post('/payments/:id/review', wrap(async (req, res) => {
  const p = review.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const s = await getSettings();
  const days = p.data.days || s.plan_days;
  const id = Number(req.params.id);
  // Only a pending payment can be reviewed — prevents double-approving
  const { rows: [pay] } = await query(
    `UPDATE payments SET status = $2, admin_note = $3, days_granted = $4, reviewed_by = $5, reviewed_at = now()
      WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, p.data.action === 'approve' ? 'approved' : 'rejected', p.data.note || null, p.data.action === 'approve' ? days : null, adminId(req)]);
  if (!pay) return res.status(409).json({ error: 'This payment was already reviewed' });

  let user;
  if (p.data.action === 'approve') {
    ({ rows: [user] } = await query(
      `UPDATE users SET paid_until = GREATEST(coalesce(paid_until, now()), now()) + ($2 || ' days')::interval WHERE id = $1 RETURNING *`,
      [pay.user_id, days]));
  } else {
    ({ rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [pay.user_id]));
  }
  await audit(adminId(req), `payment.${p.data.action}`, `payment:${id}`, { user: pay.user_id, txn: pay.txn_id, days, note: p.data.note });

  const appUrl = config.frontendUrl[0];
  const until = user.paid_until ? new Date(user.paid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  sendMail({
    to: user.email,
    subject: p.data.action === 'approve' ? '✅ Payment approved — CV matching unlocked' : 'Your payment could not be verified',
    html: layout(p.data.action === 'approve'
      ? `<p>Assalam o Alaikum ${esc(user.name || '')},</p><p>Your payment (TID <b>${esc(pay.txn_id)}</b>, Rs ${pay.amount}) has been approved. CV matching, AI tools and deadline alerts are active until <b>${esc(until)}</b>.</p>
         <p><a href="${esc(appUrl)}/matches" style="background:#0f5132;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">See my matches</a></p>`
      : `<p>Assalam o Alaikum ${esc(user.name || '')},</p><p>We couldn't verify your payment with TID <b>${esc(pay.txn_id)}</b>.${p.data.note ? ` Reason: ${esc(p.data.note)}` : ''}</p>
         <p>You can submit it again with the correct details from the <a href="${esc(appUrl)}/billing">billing page</a>.</p>`),
  }).catch((e) => console.warn('[payment email]', e.message));

  res.json({ payment: { ...pay, screenshot: undefined }, user: await userView(user) });
}));

// ── Settings ─────────────────────────────────────────────────────────────────
r.get('/settings', wrap(async (_req, res) => res.json({ settings: maskedSettings(await getSettings()) })));

const account = z.object({ title: z.string().trim().max(80), number: z.string().trim().max(40) });
const settingsSchema = z.object({
  global_free: z.boolean(),
  price_pkr: z.number().int().min(0).max(1_000_000),
  plan_days: z.number().int().min(1).max(3650),
  easypaisa: account,
  jazzcash: account,
  bank: z.object({ title: z.string().trim().max(80), bank: z.string().trim().max(80), accountNumber: z.string().trim().max(40), iban: z.string().trim().max(40), branch: z.string().trim().max(80) }),
  payment_instructions: z.string().max(1000),
  ai: z.object({ provider: z.enum(['gemini', 'openrouter', 'openai', 'anthropic']), apiKey: z.string().max(400).optional(), model: z.string().max(100), baseUrl: z.string().max(200).refine((v) => !v || /^https:\/\//.test(v), 'Base URL must start with https://'), enabled: z.boolean() }).partial(),
  ai_daily_limit: z.number().int().min(0).max(1000),
  email: z.object({ resendApiKey: z.string().max(200).optional(), from: z.string().max(200), adminNotify: z.string().max(200).refine((v) => !v || z.string().email().safeParse(v).success, 'Admin notification email is not valid') }).partial(),
}).partial().strict();

r.put('/settings', wrap(async (req, res) => {
  const p = settingsSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const current = await getSettings();
  for (const [key, value] of Object.entries(p.data)) {
    let v = value;
    if (key === 'ai' || key === 'email') {
      v = { ...current[key], ...value };
      // Secret fields: empty/missing = keep existing; "__clear__" = remove
      const secret = key === 'ai' ? 'apiKey' : 'resendApiKey';
      if (value[secret] === undefined || value[secret] === '') v[secret] = current[key][secret];
      if (value[secret] === '__clear__') v[secret] = '';
    }
    await setSetting(key, v);
  }
  const changed = Object.keys(p.data);
  await audit(adminId(req), 'settings.update', changed.join(','), Object.fromEntries(changed.map((k) => [k, k === 'ai' || k === 'email' ? '(updated)' : p.data[k]])));
  res.json({ settings: maskedSettings(await getSettings()) });
}));

r.post('/test/email', wrap(async (req, res) => {
  const s = await getSettings();
  const to = s.email.adminNotify || req.user?.email;
  if (!to) return res.status(400).json({ error: 'Set an admin notification email first' });
  try {
    const sent = await sendMail({ to, subject: 'JobRadar PK test email ✔', html: layout('<p>Email is working. Payment notifications will arrive at this address.</p>') });
    res.json({ ok: sent, to, message: sent ? `Sent to ${to}` : 'No email provider configured (add a Resend key or SMTP settings)' });
  } catch (e) { res.status(502).json({ error: e.message }); }
}));

r.post('/test/ai', wrap(async (_req, res) => {
  try { res.json(await testAI()); }
  catch (e) { res.status(e.status || 502).json({ error: e.detail || e.message }); }
}));
r.get('/ai/status', wrap(async (_req, res) => res.json({ models: await aiStatus() })));

// ── Data / jobs ──────────────────────────────────────────────────────────────
r.get('/sources', wrap(async (_req, res) => {
  const { rows } = await query(`SELECT DISTINCT ON (source) source, fetched, upserted, error, ran_at FROM ingest_runs ORDER BY source, ran_at DESC`);
  const last = Object.fromEntries(rows.map((x) => [x.source, x]));
  res.json({
    sources: ALL_SOURCES.map((s) => ({ name: s.name, label: s.label, enabled: !s.enabled || s.enabled(), last: last[s.name] || null })),
    jsearch: { credits: await creditsUsed(), searches: (await plannedSearches()).slice(0, 50) },
  });
}));
r.post('/ingest', wrap(async (req, res) => { await audit(adminId(req), 'jobs.ingest'); res.json({ result: await runIngest() }); }));
r.post('/reminders', wrap(async (req, res) => { await audit(adminId(req), 'reminders.run'); res.json(await runReminders()); }));
r.get('/searches', wrap(async (_req, res) => res.json({ credits: await creditsUsed(), searches: await plannedSearches() })));

r.get('/audit', wrap(async (_req, res) => {
  const { rows } = await query(`SELECT a.id, a.action, a.target, a.detail, a.created_at, u.email AS admin FROM audit_log a LEFT JOIN users u ON u.id = a.admin_id ORDER BY a.created_at DESC LIMIT 200`);
  res.json({ log: rows });
}));

export const SETTING_KEYS = Object.keys(DEFAULTS);
export default r;
