import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { query } from './db.js';
import { getSettings } from './lib/settings.js';

// Tokens carry the user's token_version: bumping it (password change, disable, "log out everywhere")
// instantly invalidates every token issued before. Admin sessions are short-lived.
export const signToken = (user) =>
  jwt.sign({ uid: user.id, tv: user.token_version || 0 }, config.jwtSecret, {
    expiresIn: user.role === 'admin' ? '12h' : '30d',
    algorithm: 'HS256',
  });

async function userFromToken(token) {
  const { uid, tv } = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [uid]);
  const u = rows[0];
  if (!u || u.disabled || (u.token_version || 0) !== (tv || 0)) return null;
  return u;
}

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');

export async function requireAuth(req, res, next) {
  try {
    const token = bearer(req) || (req.method === 'GET' && req.path.endsWith('.ics') ? req.query.token : '');
    if (!token) return res.status(401).json({ error: 'Please sign in' });
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'Session expired, please sign in again' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = bearer(req);
  if (token) { try { req.user = await userFromToken(token); } catch { /* ignore */ } }
  next();
}

/** Admin = signed-in user with role 'admin', or the ADMIN_KEY header (for scripts/cron). */
export async function requireAdmin(req, res, next) {
  if (config.adminKey && req.headers['x-admin-key'] && req.headers['x-admin-key'] === config.adminKey) return next();
  try {
    const user = bearer(req) ? await userFromToken(bearer(req)) : null;
    if (user?.role === 'admin') { req.user = user; return next(); }
  } catch { /* fallthrough */ }
  res.status(403).json({ error: 'Admins only' });
}

/** Can this user use CV upload / matching / AI? */
export async function accessFor(user) {
  if (!user) return { active: false, reason: 'signed_out' };
  if (user.role === 'admin') return { active: true, reason: 'admin' };
  const s = await getSettings();
  if (s.global_free) return { active: true, reason: 'free_for_all' };
  if (user.is_free) return { active: true, reason: 'free_user' };
  if (user.paid_until && new Date(user.paid_until) > new Date()) return { active: true, reason: 'paid', paid_until: user.paid_until };
  return { active: false, reason: user.paid_until ? 'expired' : 'unpaid', paid_until: user.paid_until || null };
}

export async function requireAccess(req, res, next) {
  const a = await accessFor(req.user);
  if (a.active) return next();
  const s = await getSettings();
  res.status(402).json({
    error: a.reason === 'expired'
      ? `Your subscription has ended. Renew for Rs ${s.price_pkr} to keep using CV matching.`
      : `CV matching is a paid feature (Rs ${s.price_pkr} / ${s.plan_days} days). Pay with Easypaisa or JazzCash to unlock it.`,
    code: 'PAYMENT_REQUIRED',
  });
}

export const userView = async (u) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, skills: u.skills, titles: u.titles,
  experience_years: u.experience_years, pref_locations: u.pref_locations, pref_categories: u.pref_categories,
  email_alerts: u.email_alerts, has_cv: !!u.cv_text, google: !!u.google_uid, has_password: !String(u.password_hash || '').startsWith('!'),
  country: u.country || null, domicile: u.domicile || null,
  is_free: u.is_free, paid_until: u.paid_until, access: await accessFor(u),
});

export async function audit(adminId, action, target, detail) {
  await query('INSERT INTO audit_log (admin_id, action, target, detail) VALUES ($1,$2,$3,$4)', [adminId || null, action, target || null, detail ? JSON.stringify(detail) : null]);
}
