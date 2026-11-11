import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { query } from './db.js';

export const signToken = (user) => jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: '30d' });

async function userFromToken(token) {
  const { uid } = jwt.verify(token, config.jwtSecret);
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [uid]);
  return rows[0] || null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '') || req.query.token;
    if (!token) return res.status(401).json({ error: 'Please sign in' });
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (token) { try { req.user = await userFromToken(token); } catch { /* ignore */ } }
  next();
}

export function requireAdmin(req, res, next) {
  if (!config.adminKey || req.headers['x-admin-key'] !== config.adminKey) return res.status(403).json({ error: 'Forbidden' });
  next();
}

export const publicUser = (u) => ({
  id: u.id, email: u.email, name: u.name, skills: u.skills, titles: u.titles,
  experience_years: u.experience_years, pref_locations: u.pref_locations, pref_categories: u.pref_categories,
  email_alerts: u.email_alerts, has_cv: !!u.cv_text,
});
