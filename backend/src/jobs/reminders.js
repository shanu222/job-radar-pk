import { query } from '../db.js';
import { config } from '../config.js';
import { sendMail, renderDigest } from '../lib/email.js';
import { matchJobsForUser } from './matching.js';
import { accessFor } from '../auth.js';

/**
 * Daily email per user:
 *  1. Saved jobs (not yet applied) whose deadline is within N days
 *  2. Strong CV matches whose deadline is within N days
 *  3. New strong CV matches added in the last 24h
 * Each job is mentioned at most once per reminder kind, so users aren't spammed.
 */
export async function runReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const { rows: users } = await query(`SELECT * FROM users WHERE email_alerts = TRUE AND NOT disabled`);
  let sent = 0;
  for (const u of users) {
    try {
      const { rows: savedClosing } = await query(
        `SELECT j.*, (j.deadline - CURRENT_DATE) AS days_left FROM saved_jobs s JOIN jobs j ON j.id = s.job_id
          WHERE s.user_id = $1 AND s.status = 'saved' AND j.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::int
          ORDER BY j.deadline`, [u.id, config.reminderDaysAhead]);
      // CV-match alerts are part of the paid plan; saved-job deadline reminders are free for everyone
      const paid = (await accessFor(u)).active;
      const matchClosing = paid ? await matchJobsForUser(u, { deadlineWithinDays: config.reminderDaysAhead, minScore: 55, limit: 10 }) : [];
      const newMatches = paid ? await matchJobsForUser(u, { sinceHours: 26, minScore: 55, limit: 10 }) : [];

      const already = new Set((await query(`SELECT job_id, kind FROM reminders_sent WHERE user_id = $1`, [u.id])).rows.map((r) => `${r.job_id}:${r.kind}`));
      const closingKind = (j) => `deadline-${j.days_left <= 1 ? '1d' : 'soon'}`;
      const closingMap = new Map();
      for (const j of [...savedClosing, ...matchClosing]) if (!already.has(`${j.id}:${closingKind(j)}`)) closingMap.set(j.id, j);
      const closing = [...closingMap.values()].sort((a, b) => a.days_left - b.days_left);
      const matches = newMatches.filter((j) => !closingMap.has(j.id) && !already.has(`${j.id}:match`));

      if (!closing.length && !matches.length) continue;
      const subject = closing.length
        ? `⏰ ${closing.length} job deadline${closing.length > 1 ? 's' : ''} closing soon${matches.length ? ` + ${matches.length} new matches` : ''}`
        : `✨ ${matches.length} new job${matches.length > 1 ? 's' : ''} matching your CV`;
      await sendMail({ to: u.email, subject, html: renderDigest({ name: u.name, closing, matches, appUrl: config.frontendUrl[0] }) });
      const values = [...closing.map((j) => [u.id, j.id, closingKind(j)]), ...matches.map((j) => [u.id, j.id, 'match'])];
      for (const v of values) await query(`INSERT INTO reminders_sent (user_id, job_id, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, v);
      sent++;
    } catch (e) {
      console.error(`[reminders] user ${u.id}:`, e.message);
    }
  }
  console.log(`[reminders] ${today}: sent ${sent} digests`);
  return { sent };
}
