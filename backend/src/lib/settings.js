// Admin-editable settings stored in the `settings` table, with safe defaults.
import { query } from '../db.js';

export const DEFAULTS = {
  global_free: false,                  // true = everyone gets CV matching free
  price_pkr: 1000,
  plan_days: 30,
  easypaisa: { title: 'Shahnawaz', number: '03403318127' },
  jazzcash: { title: 'Shahnawaz', number: '03403318127' },
  bank: { title: 'Shahnawaz', bank: 'HBL (Habib Bank Limited)', accountNumber: '24897000279603', iban: 'PK43HABB0024897000279603', branch: 'Karsaz, Karachi' },
  payment_instructions: '',
  ai: { provider: 'anthropic', apiKey: '', model: '', baseUrl: '', enabled: true },
  ai_daily_limit: 20,                  // AI calls per user per day
  email: { resendApiKey: '', from: '', adminNotify: process.env.ADMIN_NOTIFY_EMAIL || '' },
};

const OBJECT_KEYS = new Set(Object.entries(DEFAULTS).filter(([, v]) => v && typeof v === 'object').map(([k]) => k));
let cache = null;
let cachedAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cachedAt < 15000) return cache;
  const { rows } = await query('SELECT key, value FROM settings');
  const s = structuredClone(DEFAULTS);
  for (const r of rows) {
    if (!(r.key in DEFAULTS)) continue;
    s[r.key] = OBJECT_KEYS.has(r.key) ? { ...DEFAULTS[r.key], ...r.value } : r.value;
  }
  cache = s;
  cachedAt = Date.now();
  return s;
}

export async function setSetting(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Unknown setting ${key}`);
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
  cache = null;
}

const mask = (v) => (v ? { set: true, last4: String(v).slice(-4) } : { set: false });

/** What the admin panel sees: secrets replaced by {set,last4}. */
export function maskedSettings(s) {
  return {
    ...s,
    ai: { ...s.ai, apiKey: mask(s.ai.apiKey || process.env.ANTHROPIC_API_KEY) },
    email: { ...s.email, resendApiKey: mask(s.email.resendApiKey || process.env.RESEND_API_KEY) },
  };
}

/** What any visitor may see (pricing + where to pay). */
export function publicSettings(s) {
  return {
    global_free: s.global_free, price_pkr: s.price_pkr, plan_days: s.plan_days,
    easypaisa: s.easypaisa, jazzcash: s.jazzcash, bank: s.bank, payment_instructions: s.payment_instructions,
  };
}
