import express from 'express';
import 'express-async-errors'; // route errors from async handlers reach the error handler instead of crashing
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { config } from './config.js';
import { migrate, query } from './db.js';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import meRoutes from './routes/me.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';
import emailActionRoutes from './routes/emailActions.js';
import { runIngest, backfillEligibility } from './jobs/ingest.js';
import { runReminders } from './jobs/reminders.js';
import { seedAdmin } from './jobs/seedAdmin.js';
import { emailEnabled } from './lib/email.js';
import { firebaseEnabled } from './lib/firebase.js';

if (!config.databaseUrl) {
  console.error('DATABASE_URL is not set. On Railway: add a PostgreSQL database and set DATABASE_URL=${{Postgres.DATABASE_URL}} on this service.');
  process.exit(1);
}
if (process.env.RAILWAY_ENVIRONMENT_NAME && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('JWT_SECRET must be set to a random string of at least 32 characters.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // Railway sits behind one proxy — needed for correct per-IP rate limits
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    let host = '';
    try { host = new URL(origin).hostname; } catch { /* invalid origin */ }
    if (config.frontendUrl.includes(origin) || (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && host.endsWith('.vercel.app'))) return cb(null, true);
    cb(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }));
  },
}));
app.use(express.json({ limit: '200kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 150, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ ok: true, email: await emailEnabled(), google: firebaseEnabled() }); }
  catch { res.status(500).json({ ok: false }); }
});

app.use('/email-actions', emailActionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/me', meRoutes);
app.use('/api', jobRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large' });
  if (err.code?.startsWith?.('LIMIT_')) return res.status(400).json({ error: 'Invalid upload' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' }); // never leak internals
});

try {
  await migrate();
  await seedAdmin();
} catch (e) {
  console.error('Could not connect to the database / create tables:', e.message);
  process.exit(1);
}
app.listen(config.port, () => console.log(`JobRadar API on :${config.port}`));
backfillEligibility().catch((e) => console.error('[eligibility backfill]', e.message));

cron.schedule(config.ingestCron, () => runIngest().catch((e) => console.error('[cron ingest]', e)));
cron.schedule(config.reminderCron, () => runReminders().catch((e) => console.error('[cron reminders]', e)));
if (config.runIngestOnBoot) setTimeout(() => runIngest().catch(console.error), 5000);
