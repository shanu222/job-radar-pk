import { query } from '../db.js';
import { scoreJob } from '../lib/match.js';
import { eligibilitySql } from '../lib/eligibility.js';

/** Build a Postgres websearch query (OR of skills + title words) to pre-filter candidates. */
function tsQueryFor(user) {
  const terms = [...(user.skills || []), ...(user.titles || []).flatMap((t) => t.split(/\s+/))]
    .map((s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim())
    .filter((s) => s.length > 1);
  return [...new Set(terms)].slice(0, 60).map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' or ');
}

/**
 * Jobs ranked for a user.
 * opts: { limit, minScore, sinceHours, deadlineWithinDays, category, remoteOnly, country }
 */
export async function matchJobsForUser(user, opts = {}) {
  const { limit = 50, minScore = 35, sinceHours, deadlineWithinDays, category, remoteOnly, country } = opts;
  if (!user.skills?.length && !user.titles?.length) return [];
  const params = [tsQueryFor(user)];
  const where = [`search @@ websearch_to_tsquery('english', $1)`, `(deadline IS NULL OR deadline >= CURRENT_DATE)`];
  if (sinceHours) { params.push(sinceHours); where.push(`created_at > now() - ($${params.length} || ' hours')::interval`); }
  if (deadlineWithinDays != null) { params.push(deadlineWithinDays); where.push(`deadline IS NOT NULL AND deadline <= CURRENT_DATE + $${params.length}::int`); }
  if (category) { params.push(category); where.push(`category = $${params.length}`); }
  if (country) { params.push(country); where.push(`country = $${params.length}`); }
  if (remoteOnly) where.push('is_remote');
  // Only jobs this person can really apply for: their country/region, and domicile for govt jobs
  where.push(eligibilitySql(params, { country: user.country || 'PK', domicile: user.domicile }));

  const { rows } = await query(
    `SELECT id, source, title, company, location, country, category, is_remote, tags, salary, url, posted_at, deadline, domiciles, eligible,
            left(description, 3000) AS description,
            (deadline - CURRENT_DATE) AS days_left
       FROM jobs WHERE ${where.join(' AND ')}
       ORDER BY ts_rank(search, websearch_to_tsquery('english', $1)) DESC
       LIMIT 1500`,
    params
  );
  return rows
    .map((j) => ({ ...j, ...scoreJob(j, user) }))
    .filter((j) => j.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ description, ...j }) => ({ ...j, snippet: description?.slice(0, 280) }));
}
