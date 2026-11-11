const env = process.env;

export const config = {
  port: Number(env.PORT || 4000),
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET || 'dev-only-change-me',
  frontendUrl: (env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim()),
  adminKey: env.ADMIN_KEY || '',

  // Optional paid/keyed sources
  rapidApiKey: env.RAPIDAPI_KEY || '', // JSearch (Google Jobs aggregator, covers Pakistan + world)
  anthropicKey: env.ANTHROPIC_API_KEY || '', // optional: smarter CV skill extraction

  // Email (any SMTP: Gmail app password, Resend SMTP, Brevo, Zoho...)
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'JobRadar PK <alerts@example.com>',
  },

  // Cron schedules (server time is UTC on Railway). Defaults: ingest every 3h, reminders 04:00 UTC = 9:00 PKT
  ingestCron: env.INGEST_CRON || '0 */3 * * *',
  reminderCron: env.REMINDER_CRON || '0 4 * * *',
  reminderDaysAhead: Number(env.REMINDER_DAYS_AHEAD || 3),
  runIngestOnBoot: env.RUN_INGEST_ON_BOOT !== 'false',
  userAgent: env.SCRAPER_USER_AGENT || 'JobRadarPK/1.0 (+https://jobradar.pk; job aggregator)',
};
