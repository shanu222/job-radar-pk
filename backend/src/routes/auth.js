import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import { signToken, requireAuth, userView } from '../auth.js';
import { verifyFirebaseIdToken, firebaseEnabled } from '../lib/firebase.js';
import { COUNTRIES, PROVINCES } from '../lib/eligibility.js';
import { searchForUser } from '../jobs/personalSearch.js';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { sendMail, emailEnabled, esc, layout } from '../lib/email.js';

const r = Router();

// Brute-force protection: 10 login attempts / 15 min per IP, 5 sign-ups / hour per IP
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
const signupLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-ups from this network. Try again later.' } });

const password = z.string().min(8, 'Password must be at least 8 characters').max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain letters and numbers');
const email = z.string().trim().toLowerCase().email('Enter a valid email').max(200);
const country = z.string().refine((c) => c in COUNTRIES, 'Choose your country');
const domicile = z.string().refine((d) => d in PROVINCES, 'Choose your domicile province');

// A real bcrypt hash of a random string, used so failed logins take the same time whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync(String(Math.random()), 11);

r.post('/register', signupLimiter, async (req, res) => {
  const p = z.object({ email, password, name: z.string().trim().max(100).optional(), country, domicile: domicile.optional() })
    .refine((d) => d.country !== 'PK' || d.domicile, { message: 'Choose your domicile province (needed for government jobs)' })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const { email: em, password: pw, name, country: ctry, domicile: dom } = p.data;
  const exists = await query('SELECT 1 FROM users WHERE email = $1', [em]);
  if (exists.rowCount) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  const hash = await bcrypt.hash(pw, 11);
  const { rows } = await query('INSERT INTO users (email, name, password_hash, country, domicile, last_login) VALUES ($1,$2,$3,$4,$5, now()) RETURNING *', [em, name || null, hash, ctry, ctry === 'PK' ? dom : null]);
  res.json({ token: signToken(rows[0]), user: await userView(rows[0]) });
});

r.post('/login', loginLimiter, async (req, res) => {
  const p = z.object({ email, password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Enter your email and password' });
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [p.data.email]);
  const u = rows[0];
  const hash = u && !String(u.password_hash).startsWith('!') ? u.password_hash : DUMMY_HASH;
  const ok = await bcrypt.compare(p.data.password, hash);
  if (!u || !ok) {
    if (u && String(u.password_hash).startsWith('!')) return res.status(401).json({ error: 'This account uses Google sign-in. Click “Continue with Google”.' });
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  if (u.disabled) return res.status(403).json({ error: 'This account has been suspended. Contact support.' });
  await query('UPDATE users SET last_login = now() WHERE id = $1', [u.id]);
  res.json({ token: signToken(u), user: await userView(u) });
});

/** Google sign-in via Firebase: the browser sends its Firebase ID token, we verify it with Google's keys. */
r.post('/google', loginLimiter, async (req, res) => {
  if (!firebaseEnabled()) return res.status(503).json({ error: 'Google sign-in is not set up yet' });
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  let g;
  try { g = await verifyFirebaseIdToken(idToken); }
  catch { return res.status(401).json({ error: 'Google sign-in failed. Please try again.' }); }
  if (!g.email || g.email_verified !== true) return res.status(401).json({ error: 'Your Google email is not verified' });
  const em = String(g.email).toLowerCase();

  let { rows } = await query('SELECT * FROM users WHERE google_uid = $1', [g.sub]);
  let u = rows[0];
  if (!u) {
    ({ rows } = await query('SELECT * FROM users WHERE email = $1', [em]));
    if (rows[0]) {
      // Same verified email → link Google to the existing account
      ({ rows } = await query('UPDATE users SET google_uid = $2, name = COALESCE(name, $3) WHERE id = $1 RETURNING *', [rows[0].id, g.sub, g.name || null]));
    } else {
      ({ rows } = await query(`INSERT INTO users (email, name, password_hash, google_uid) VALUES ($1,$2,'!google',$3) RETURNING *`, [em, g.name || null, g.sub]));
    }
    u = rows[0];
  }
  if (u.disabled) return res.status(403).json({ error: 'This account has been suspended. Contact support.' });
  await query('UPDATE users SET last_login = now() WHERE id = $1', [u.id]);
  res.json({ token: signToken(u), user: await userView(u) });
});

r.get('/me', requireAuth, async (req, res) => res.json({ user: await userView(req.user) }));

const prefs = z.object({
  name: z.string().trim().max(100).optional(),
  skills: z.array(z.string().max(60)).max(80).optional(),
  titles: z.array(z.string().max(100)).max(10).optional(),
  experience_years: z.number().int().min(0).max(50).nullable().optional(),
  pref_locations: z.array(z.string().max(60)).max(20).optional(),
  pref_categories: z.array(z.enum(['govt', 'private', 'remote', 'freelance'])).optional(),
  email_alerts: z.boolean().optional(),
  country: country.optional(),
  domicile: domicile.nullable().optional(),
}).strict();

r.patch('/me', requireAuth, async (req, res) => {
  const p = prefs.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  if (p.data.country && p.data.country !== 'PK') p.data.domicile = null; // domicile only applies to Pakistanis
  if (p.data.country === 'PK' && !p.data.domicile && !req.user.domicile) return res.status(400).json({ error: 'Choose your domicile province (needed for government jobs)' });
  const fields = Object.entries(p.data);
  if (!fields.length) return res.json({ user: await userView(req.user) });
  // Column names come only from the zod schema keys above — never from user input
  const sets = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await query(`UPDATE users SET ${sets} WHERE id = $1 RETURNING *`, [req.user.id, ...fields.map(([, v]) => (Array.isArray(v) ? v.map((s) => s.trim()).filter(Boolean) : v))]);
  const searchInputsChanged = ['titles', 'skills', 'pref_locations', 'pref_categories'].some((k) => k in p.data);
  const view = await userView(rows[0]);
  if (searchInputsChanged && view.access.active) searchForUser(rows[0]).catch((e) => console.warn('[profile] personal search:', e.message));
  res.json({ user: view, searching: searchInputsChanged && view.access.active });
});

r.post('/password', requireAuth, loginLimiter, async (req, res) => {
  const p = z.object({ current: z.string().max(128).optional(), next: password }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const hasPassword = !String(req.user.password_hash).startsWith('!');
  if (hasPassword && !(await bcrypt.compare(p.data.current || '', req.user.password_hash))) return res.status(401).json({ error: 'Current password is wrong' });
  const hash = await bcrypt.hash(p.data.next, 11);
  // Bumping token_version signs out every other device
  const { rows } = await query('UPDATE users SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING *', [req.user.id, hash]);
  res.json({ token: signToken(rows[0]), user: await userView(rows[0]) });
});

// ── Delete my account: a 6-digit code is emailed to the account's address, then confirmed ──
const deleteLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, keyGenerator: (req) => `del${req.user?.id}`, message: { error: 'Too many requests. Try again in an hour.' } });
const codeHash = (userId, code) => createHmac('sha256', config.jwtSecret).update(`delete:${userId}:${code}`).digest('hex');

r.post('/delete/request', requireAuth, deleteLimiter, async (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin accounts can’t be deleted here. Remove the admin role first.' });
  if (!(await emailEnabled())) return res.status(503).json({ error: 'Email is not available right now. Please try again later.' });
  const code = String(randomInt(100000, 1000000));
  await query(
    `INSERT INTO account_deletion_codes (user_id, code_hash, expires_at, attempts) VALUES ($1, $2, now() + interval '15 minutes', 0)
     ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0`,
    [req.user.id, codeHash(req.user.id, code)]);
  await sendMail({
    to: req.user.email,
    subject: `${code} is your JobRadar PK account deletion code`,
    html: layout(`<p>Assalam o Alaikum ${esc(req.user.name || '')},</p>
      <p>Someone (hopefully you) asked to <b>permanently delete</b> your JobRadar PK account. Enter this code to confirm:</p>
      <p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p>
      <p style="color:#555">It expires in 15 minutes. If you didn't ask for this, ignore this email — your account is safe — and consider changing your password.</p>`),
  });
  const [name, domain] = req.user.email.split('@');
  res.json({ sentTo: `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}` });
});

r.post('/delete/confirm', requireAuth, deleteLimiter, async (req, res) => {
  const code = String(req.body?.code || '').replace(/\D/g, '');
  if (code.length !== 6) return res.status(400).json({ error: 'Enter the 6-digit code from the email' });
  const { rows: [row] } = await query('SELECT * FROM account_deletion_codes WHERE user_id = $1', [req.user.id]);
  if (!row || new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'This code has expired. Request a new one.' });
  if (row.attempts >= 5) return res.status(429).json({ error: 'Too many wrong codes. Request a new one.' });
  const a = Buffer.from(codeHash(req.user.id, code), 'hex');
  const b = Buffer.from(row.code_hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await query('UPDATE account_deletion_codes SET attempts = attempts + 1 WHERE user_id = $1', [req.user.id]);
    return res.status(400).json({ error: 'That code is not correct' });
  }
  const email = req.user.email;
  await query('DELETE FROM users WHERE id = $1', [req.user.id]); // cascades: saved jobs, payments, AI cache, codes
  sendMail({ to: email, subject: 'Your JobRadar PK account has been deleted', html: layout('<p>Your account and all its data (CV, saved jobs, payment records) have been permanently deleted. Allah Hafiz!</p>') }).catch(() => {});
  res.json({ ok: true });
});

export default r;
