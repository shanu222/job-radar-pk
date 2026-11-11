import { query } from '../db.js';
import { activeSources } from '../sources/index.js';

const clean = (j, source) => {
  if (!j.title || !j.url || !j.external_id) return null;
  const posted = j.posted_at ? new Date(j.posted_at) : null;
  return {
    source,
    external_id: String(j.external_id).slice(0, 300),
    title: String(j.title).trim().slice(0, 300),
    company: j.company ? String(j.company).slice(0, 200) : null,
    location: j.location ? String(j.location).slice(0, 200) : null,
    country: j.country || 'INTL',
    category: j.category || 'private',
    is_remote: !!j.is_remote,
    description: j.description ? String(j.description).slice(0, 15000) : null,
    tags: [...new Set((j.tags || []).filter(Boolean).map((t) => String(t).slice(0, 60)))].slice(0, 15),
    salary: j.salary || null,
    url: j.url,
    posted_at: posted && !isNaN(posted) ? posted.toISOString() : null,
    deadline: j.deadline || null,
  };
};

async function upsert(rows) {
  let n = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const cols = ['source', 'external_id', 'title', 'company', 'location', 'country', 'category', 'is_remote', 'description', 'tags', 'salary', 'url', 'posted_at', 'deadline'];
    const values = [];
    const placeholders = chunk.map((r, ri) => `(${cols.map((c, ci) => { values.push(r[c]); return `$${ri * cols.length + ci + 1}`; }).join(',')})`);
    const res = await query(
      `INSERT INTO jobs (${cols.join(',')}) VALUES ${placeholders.join(',')}
       ON CONFLICT (source, external_id) DO UPDATE SET
         title = EXCLUDED.title, company = EXCLUDED.company, location = EXCLUDED.location,
         description = COALESCE(EXCLUDED.description, jobs.description), tags = EXCLUDED.tags,
         salary = COALESCE(EXCLUDED.salary, jobs.salary), url = EXCLUDED.url,
         deadline = COALESCE(EXCLUDED.deadline, jobs.deadline),
         posted_at = COALESCE(jobs.posted_at, EXCLUDED.posted_at), updated_at = now()`,
      values
    );
    n += res.rowCount;
  }
  return n;
}

let running = false;
/** Clean, de-dupe and upsert a batch of normalized jobs from one source. Returns rows written. */
export async function saveJobs(source, raw) {
  // De-dupe within a batch (ON CONFLICT can't touch the same row twice in one statement)
  const map = new Map();
  for (const j of raw) { const c = clean(j, source); if (c) map.set(c.external_id, c); }
  const rows = [...map.values()];
  return rows.length ? upsert(rows) : 0;
}

export async function runIngest() {
  if (running) return { skipped: true };
  running = true;
  const summary = [];
  try {
    for (const src of activeSources()) {
      const t0 = Date.now();
      try {
        const raw = await src.fetch();
        const upserted = await saveJobs(src.name, raw);
        await query('INSERT INTO ingest_runs (source, fetched, upserted) VALUES ($1,$2,$3)', [src.name, raw.length, upserted]);
        summary.push({ source: src.name, fetched: raw.length, upserted, ms: Date.now() - t0 });
        console.log(`[ingest] ${src.name}: ${raw.length} fetched, ${upserted} upserted (${Date.now() - t0}ms)`);
      } catch (e) {
        await query('INSERT INTO ingest_runs (source, fetched, upserted, error) VALUES ($1,0,0,$2)', [src.name, e.message.slice(0, 500)]);
        summary.push({ source: src.name, error: e.message });
        console.error(`[ingest] ${src.name} failed:`, e.message);
      }
    }
    // Housekeeping: drop expired and stale listings (keep saved ones via FK? → no, keep them if saved)
    await query(`DELETE FROM jobs j WHERE (
        (j.deadline IS NOT NULL AND j.deadline < CURRENT_DATE - INTERVAL '14 days') OR
        (j.deadline IS NULL AND COALESCE(j.posted_at, j.created_at) < now() - INTERVAL '60 days'))
      AND NOT EXISTS (SELECT 1 FROM saved_jobs s WHERE s.job_id = j.id)`);
  } finally {
    running = false;
  }
  return summary;
}
