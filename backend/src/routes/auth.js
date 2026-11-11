import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { signToken, requireAuth, publicUser } from '../auth.js';

const r = Router();

const creds = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(8, 'Password must be at least 8 characters'), name: z.string().max(100).optional() });

r.post('/register', async (req, res) => {
  const p = creds.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const { email, password, name } = p.data;
  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) return res.status(409).json({ error: 'An account with this email already exists' });
  const hash = await bcrypt.hash(password, 11);
  const { rows } = await query('INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING *', [email, name || null, hash]);
  res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
});

r.post('/login', async (req, res) => {
  const p = creds.omit({ name: true }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Enter a valid email and password' });
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [p.data.email]);
  if (!rows[0] || !(await bcrypt.compare(p.data.password, rows[0].password_hash))) return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

const prefs = z.object({
  name: z.string().max(100).optional(),
  skills: z.array(z.string().max(60)).max(80).optional(),
  titles: z.array(z.string().max(100)).max(10).optional(),
  experience_years: z.number().int().min(0).max(50).nullable().optional(),
  pref_locations: z.array(z.string().max(60)).max(20).optional(),
  pref_categories: z.array(z.enum(['govt', 'private', 'remote', 'freelance'])).optional(),
  email_alerts: z.boolean().optional(),
});

r.patch('/me', requireAuth, async (req, res) => {
  const p = prefs.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const fields = Object.entries(p.data);
  if (!fields.length) return res.json({ user: publicUser(req.user) });
  const sets = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await query(`UPDATE users SET ${sets} WHERE id = $1 RETURNING *`, [req.user.id, ...fields.map(([, v]) => (Array.isArray(v) ? v.map((s) => s.trim()).filter(Boolean) : v))]);
  res.json({ user: publicUser(rows[0]) });
});

r.delete('/me', requireAuth, async (req, res) => {
  await query('DELETE FROM users WHERE id = $1', [req.user.id]);
  res.json({ ok: true });
});

export default r;
