import { query } from '../db.js';
import { scoreJob } from '../lib/match.js';
import { eligibilitySql, userLanguages, canApplyDomicile } from '../lib/eligibility.js';

/** Build a Postgres websearch query (OR of skills + title words) to pre-filter candidates. */
function tsQueryFor(user) {
  const terms = [...(user.skills || []), ...(user.titles || []).flatMap((t) => t.split(/\s+/))]
    .map((s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim())
    .filter((s) => s.length > 1);
  return [...new Set(terms)].slice(0, 60).map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' or ');
}

/**
 * Score a job; when the full ad has been read and lists several posts (consolidated govt ads),
 * score each post and keep the one that fits this person best.
 */
export function scoreWithPositions(job, user) {
  const base = scoreJob(job, user);
  const d = job.details;
  if (!d || d.error) return base;
  const reqText = [...(d.requirements || []), ...(d.responsibilities || [])].join('. ');
  // Re-score with the extracted requirements (more precise than the raw listing)
  let best = scoreJob({ ...job, description: `${reqText}\n${job.description || ''}` }, user);
  if (base.score > best.score) best = base;
  let matched_position = null;
  const posts = d.positions || [];
  if (posts.length > 1) {
    let top = null;
    for (const p of posts) {
      const s = scoreJob({ ...job, title: p.title, description: [p.qualification, p.experience, reqText].filter(Boolean).join('. ') }, user);
      if (!top || s.score > top.s.score) top = { p, s };
    }
    if (top && top.s.relevant) { best = top.s.score >= best.score ? top.s : { ...best, relevant: true }; matched_position = top.p; }
    else if (top && !top.s.relevant) best = { ...best, relevant: false }; // none of the posts fit
  } else if (posts.length === 1) matched_position = { ...posts[0], single: true };
  return { ...best, matched_position };
}

/**
 * Jobs that fit a user's CV and that they can apply for, best first.
 * opts: { limit, minScore, sinceHours, deadlineWithinDays, category, remoteOnly, country, q, source, sort }
 */
export async function matchJobsForUser(user, opts = {}) {
  const { limit = 50, minScore = 40, sinceHours, deadlineWithinDays, category, remoteOnly, country, q, source, sort } = opts;
  if (!user.skills?.length && !user.titles?.length) return [];
  const params = [tsQueryFor(user)];
  const where = [`search @@ websearch_to_tsquery('english', $1)`, `(deadline IS NULL OR deadline >= CURRENT_DATE)`];
  if (sinceHours) { params.push(sinceHours); where.push(`created_at > now() - ($${params.length} || ' hours')::interval`); }
  if (deadlineWithinDays != null) { params.push(deadlineWithinDays); where.push(`deadline IS NOT NULL AND deadline <= CURRENT_DATE + $${params.length}::int`); }
  if (category) { params.push(String(category).split(',')); where.push(`category = ANY($${params.length})`); }
  if (country) { params.push(country); where.push(`country = $${params.length}`); }
  if (source) { params.push(String(source).split(',')); where.push(`source = ANY($${params.length})`); }
  if (q) { params.push(q); where.push(`search @@ websearch_to_tsquery('english', $${params.length})`); }
  if (remoteOnly) where.push('is_remote');
  // Only jobs this person can really apply for: country/region, languages, and domicile for govt jobs
  where.push(eligibilitySql(params, { country: user.country || 'PK', domicile: user.domicile, languages: user.languages || userLanguages(user) }));

  const { rows } = await query(
    `SELECT id, source, title, company, location, country, category, is_remote, tags, salary, url, posted_at, deadline, domiciles, eligible,
            details, details_status, left(description, 3000) AS description,
            (deadline - CURRENT_DATE) AS days_left
       FROM jobs WHERE ${where.join(' AND ')}
       ORDER BY ts_rank(search, websearch_to_tsquery('english', $1)) DESC
       LIMIT 1500`,
    params
  );
  const scored = rows
    .map((j) => ({ ...j, ...scoreWithPositions(j, user) }))
    // A consolidated ad may have a post reserved for another domicile
    .filter((j) => !j.matched_position?.domicile_quota || j.category !== 'govt' || canApplyDomicile(j.domiciles, user.domicile))
    .filter((j) => j.relevant && j.score >= minScore);
  if (sort === 'deadline') scored.sort((a, b) => (a.deadline || '9999') .localeCompare(b.deadline || '9999') || b.score - a.score);
  else if (sort === 'newest') scored.sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));
  else scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ description, details, ...j }) => ({
    ...j,
    summary: details?.summary || null,
    snippet: details?.summary ? null : description?.slice(0, 280),
    highlights: details?.requirements?.slice(0, 3) || [],
  }));
}
