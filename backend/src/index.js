import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { config } from './config.js';
import { migrate, query } from './db.js';
import { requireAdmin } from './auth.js';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import meRoutes from './routes/me.js';
import { runIngest } from './jobs/ingest.js';
import { runReminders } from './jobs/reminders.js';
import { emailEnabled } from './lib/email.js';

const app = express();
app.set('trust proxy', 1); // Railway sits behind a proxy
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.frontendUrl.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname) && process.env.ALLOW_VERCEL_PREVIEWS === 'true') return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
}));
app.use(express.json({ limit: '200kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60_000, limit: 30 }));

app.get('/health', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ ok: true, email: emailEnabled() }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.use('/api/auth', authRoutes);
app.use('/api', jobRoutes);
app.use('/api/me', meRoutes);

app.post('/api/admin/ingest', requireAdmin, async (_req, res) => res.json({ result: await runIngest() }));
app.post('/api/admin/reminders', requireAdmin, async (_req, res) => res.json(await runReminders()));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message?.startsWith('CORS') ? err.message : 'Something went wrong' });
});

await migrate();
app.listen(config.port, () => console.log(`JobRadar API on :${config.port}`));

cron.schedule(config.ingestCron, () => runIngest().catch((e) => console.error('[cron ingest]', e)));
cron.schedule(config.reminderCron, () => runReminders().catch((e) => console.error('[cron reminders]', e)));
if (config.runIngestOnBoot) setTimeout(() => runIngest().catch(console.error), 5000);
