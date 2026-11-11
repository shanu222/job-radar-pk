// Creates/promotes the admin account from ADMIN_EMAIL + ADMIN_PASSWORD on startup.
// The password is only (re)applied when ADMIN_PASSWORD itself changes, so a password changed later
// in the app isn't overwritten on every deploy. Nothing secret is stored in the code or the repo.
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { query } from '../db.js';

export async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email) return;
  const fingerprint = createHash('sha256').update(`${email}:${password}`).digest('hex');

  const { rows: [seen] } = await query(`SELECT value FROM settings WHERE key = '_admin_seed'`);
  const { rows: [user] } = await query('SELECT id, role FROM users WHERE email = $1', [email]);
  const pwChanged = password && seen?.value?.fp !== fingerprint;

  if (!user) {
    if (!password) { console.warn('[admin] ADMIN_EMAIL set but ADMIN_PASSWORD missing — admin not created'); return; }
    const hash = await bcrypt.hash(password, 12);
    await query(`INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'Admin', $2, 'admin')`, [email, hash]);
    console.log(`[admin] created admin account ${email}`);
  } else {
    if (user.role !== 'admin') await query(`UPDATE users SET role = 'admin', token_version = token_version + 1 WHERE id = $1`, [user.id]);
    if (pwChanged) {
      const hash = await bcrypt.hash(password, 12);
      await query('UPDATE users SET password_hash = $2, token_version = token_version + 1, disabled = FALSE WHERE id = $1', [user.id, hash]);
      console.log(`[admin] admin password updated from ADMIN_PASSWORD for ${email}`);
    }
  }
  // Settings rows starting with "_" are internal; not exposed by the settings API
  await query(`INSERT INTO settings (key, value) VALUES ('_admin_seed', $1::jsonb)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [JSON.stringify({ fp: fingerprint })]);
}
