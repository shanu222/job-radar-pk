import { Router } from 'express';
import { query } from '../db.js';
import { optionalAuth, accessFor } from '../auth.js';
import { scoreJob } from '../lib/match.js';
import { ALL_SOURCES } from '../sources/index.js';
import { creditsUsed, plannedSearches } from '../sources/jsearch.js';

const r = Router();
const LIST_COLS = `id, source, title, company, location, country, category, is_remote, tags, salary, url, posted_at, deadline,
  left(description, 280) AS snippet, (deadline - CURRENT_DATE) AS days_left`;

/** GET /api/jobs — search + filters + pagination */
r.get('/jobs', optionalAuth, async (req, res) => {
  const { q, category, country, remote, source, deadline, sort = 'newest' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(50, Number(req.query.size) || 20);
  const params = [];
  const where = ['(deadline IS NULL OR deadline >= CURRENT_DATE)'];
  const add = (v) => { params.push(v); return `$${params.length}`; };

  if (q) where.push(`search @@ websearch_to_tsquery('english', ${add(q)})`);
  if (category) where.push(`category = ANY(${add(String(category).split(','))})`);
  if (country) where.push(`country = ${add(country)}`);
  if (remote === 'true') where.push('is_remote');
  if (source) where.push(`source = ANY(${add(String(source).split(','))})`);
  if (deadline === 'has') where.push('deadline IS NOT NULL');
  if (/^\d+$/.test(deadline || '')) where.push(`deadline IS NOT NULL AND deadline <= CURRENT_DATE + ${add(Number(deadline))}::int`);

  const order = {
    newest: 'COALESCE(posted_at, created_at) DESC',
    deadline: 'deadline ASC NULLS LAST, COALESCE(posted_at, created_at) DESC',
    relevance: q ? `ts_rank(search, websearch_to_tsquery('english', $1)) DESC` : 'COALESCE(posted_at, created_at) DESC',
  }[sort] || 'COALESCE(posted_at, created_at) DESC';

  const w = where.join(' AND ');
  const [{ rows }, { rows: [{ count }] }] = await Promise.all([
    query(`SELECT ${LIST_COLS}, left(description, 3000) AS _desc FROM jobs WHERE ${w} ORDER BY ${order} LIMIT ${size} OFFSET ${(page - 1) * size}`, params),
    query(`SELECT count(*)::int FROM jobs WHERE ${w}`, params),
  ]);
  const scoring = req.user?.skills?.length && (await accessFor(req.user)).active;
  const jobs = rows.map(({ _desc, ...j }) =>
    scoring ? { ...j, ...scoreJob({ ...j, description: _desc }, req.user) } : j
  );
  res.json({ jobs, total: count, page, pages: Math.ceil(count / size) });
});

r.get('/jobs/stats', async (_req, res) => {
  const { rows: [s] } = await query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE category = 'govt')::int AS govt,
      count(*) FILTER (WHERE category = 'private')::int AS private,
      count(*) FILTER (WHERE is_remote)::int AS remote,
      count(*) FILTER (WHERE category = 'freelance')::int AS freelance,
      count(*) FILTER (WHERE country = 'PK')::int AS pakistan,
      count(*) FILTER (WHERE deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::int AS closing_week,
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS new_today
    FROM jobs WHERE deadline IS NULL OR deadline >= CURRENT_DATE`);
  const { rows: bySource } = await query(`SELECT source, count(*)::int AS n FROM jobs GROUP BY source ORDER BY n DESC`);
  res.json({ ...s, bySource });
});

/** Deadlines calendar: jobs with a known deadline in the next N days, grouped by date */
r.get('/deadlines', optionalAuth, async (req, res) => {
  const days = Math.min(90, Number(req.query.days) || 14);
  const params = [days];
  let extra = '';
  if (req.query.category) { params.push(String(req.query.category).split(',')); extra += ` AND category = ANY($${params.length})`; }
  if (req.query.country) { params.push(req.query.country); extra += ` AND country = $${params.length}`; }
  const { rows } = await query(
    `SELECT ${LIST_COLS} FROM jobs WHERE deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int ${extra}
     ORDER BY deadline, title LIMIT 600`, params);
  const groups = {};
  for (const j of rows) {
    const key = j.deadline;
    (groups[key] ||= []).push(j);
  }
  res.json({ days, groups: Object.entries(groups).map(([date, jobs]) => ({ date, jobs })) });
});

r.get('/jobs/:id', optionalAuth, async (req, res) => {
  const { rows } = await query(`SELECT *, (deadline - CURRENT_DATE) AS days_left FROM jobs WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Job not found' });
  const { search, ...job } = rows[0];
  const scoring = req.user?.skills?.length && (await accessFor(req.user)).active;
  res.json({ job: scoring ? { ...job, ...scoreJob(job, req.user) } : job });
});

r.get('/sources', async (_req, res) => {
  const { rows } = await query(`SELECT DISTINCT ON (source) source, fetched, upserted, error, ran_at FROM ingest_runs ORDER BY source, ran_at DESC`);
  const last = Object.fromEntries(rows.map((r) => [r.source, r]));
  const searches = await plannedSearches();
  res.json({
    sources: ALL_SOURCES.map((s) => ({ name: s.name, label: s.label, homepage: s.homepage, enabled: !s.enabled || s.enabled(), last: last[s.name] || null })),
    jsearch: { credits: await creditsUsed(), plannedSearches: searches.length },
  });
});

export default r;
