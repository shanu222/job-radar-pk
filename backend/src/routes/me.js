import { Router } from 'express';
import multer from 'multer';
import { query } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { extractText, buildProfileFromCV } from '../lib/cvparse.js';
import { matchJobsForUser } from '../jobs/matching.js';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** Upload CV → extract skills/titles/experience → saved on the user. */
r.post('/cv', requireAuth, upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach your CV as a PDF, DOCX or TXT file' });
  let text;
  try { text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!text || text.trim().length < 80) return res.status(400).json({ error: 'Could not read text from this CV. If it is a scanned image, upload a text-based PDF or DOCX.' });
  const profile = await buildProfileFromCV(text);
  const { rows } = await query(
    `UPDATE users SET cv_text = $2, skills = $3, titles = $4, experience_years = $5 WHERE id = $1 RETURNING *`,
    [req.user.id, text.slice(0, 50000), profile.skills, profile.titles, profile.experience_years]
  );
  res.json({ user: publicUser(rows[0]), extracted: profile });
});

/** Jobs ranked against the user's CV. */
r.get('/matches', requireAuth, async (req, res) => {
  const jobs = await matchJobsForUser(req.user, {
    limit: Math.min(100, Number(req.query.limit) || 60),
    minScore: Number(req.query.minScore) || 35,
    category: req.query.category || undefined,
    country: req.query.country || undefined,
    remoteOnly: req.query.remote === 'true',
    deadlineWithinDays: req.query.closing ? Number(req.query.closing) : undefined,
  });
  res.json({ jobs, profileReady: !!(req.user.skills?.length || req.user.titles?.length) });
});

/** Saved jobs / application tracker */
r.get('/saved', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT j.id, j.source, j.title, j.company, j.location, j.country, j.category, j.is_remote, j.tags, j.url, j.deadline,
            (j.deadline - CURRENT_DATE) AS days_left, s.status, s.created_at AS saved_at
       FROM saved_jobs s JOIN jobs j ON j.id = s.job_id WHERE s.user_id = $1
       ORDER BY (j.deadline IS NULL), j.deadline, s.created_at DESC`, [req.user.id]);
  res.json({ jobs: rows });
});

r.post('/saved/:jobId', requireAuth, async (req, res) => {
  await query(`INSERT INTO saved_jobs (user_id, job_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.user.id, req.params.jobId]);
  res.json({ ok: true });
});

r.patch('/saved/:jobId', requireAuth, async (req, res) => {
  const status = req.body?.status;
  if (!['saved', 'applied', 'interview', 'rejected', 'offer'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await query(`UPDATE saved_jobs SET status = $3 WHERE user_id = $1 AND job_id = $2`, [req.user.id, req.params.jobId, status]);
  res.json({ ok: true });
});

r.delete('/saved/:jobId', requireAuth, async (req, res) => {
  await query(`DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2`, [req.user.id, req.params.jobId]);
  res.json({ ok: true });
});

/** Calendar feed (.ics) of saved-job deadlines — subscribe from Google Calendar / Outlook. */
r.get('/saved/calendar.ics', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT j.id, j.title, j.company, j.url, j.deadline FROM saved_jobs s JOIN jobs j ON j.id = s.job_id
      WHERE s.user_id = $1 AND j.deadline IS NOT NULL AND s.status IN ('saved','applied')`, [req.user.id]);
  const esc = (s) => String(s || '').replace(/[,;\\]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const d = (x) => String(x).replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = rows.map((j) => [
    'BEGIN:VEVENT', `UID:jobradar-${j.id}@jobradar`, `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${d(j.deadline)}`, `SUMMARY:${esc(`Deadline: ${j.title}`)}`,
    `DESCRIPTION:${esc(`${j.company || ''}\n${j.url}`)}`, `URL:${j.url}`,
    'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(j.title)} closes in 2 days`, 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n'));
  res.type('text/calendar').send(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//JobRadar PK//EN', 'X-WR-CALNAME:Job deadlines', ...events, 'END:VCALENDAR'].join('\r\n'));
});

export default r;
