// JSearch (RapidAPI) = Google for Jobs data: LinkedIn, Indeed, Rozee.pk, Glassdoor, company career pages…
//
// Searches are built from users' CVs, not a fixed list: each user's job titles (or top skills, if the
// CV has no clear titles) × their preferred locations (default Pakistan), plus a remote search when
// they want remote work. Queries shared by many users are run first.
//
// Every result page (≤10 jobs) costs 1 request credit, so spending is capped:
//   JSEARCH_MONTHLY_CREDITS  hard monthly cap, tracked in the database (default 180 ≈ free plan)
//   JSEARCH_MAX_QUERIES      max searches per scheduled run (default 6)
//   JSEARCH_MIN_HOURS        a query is not repeated within this many hours (default 24)
//   JSEARCH_PAGES            result pages per search (default 1)
//   JSEARCH_FALLBACK_QUERIES optional "q1|q2" used only while no user has uploaded a CV
//
// Get a key: rapidapi.com → search "JSearch" → the verified one by OpenWeb Ninja.
import { config } from '../config.js';
import { query } from '../db.js';
import { getJSON } from '../lib/http.js';
import { extractDeadline, toISODate } from '../lib/deadline.js';

const num = (v, d) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const MONTHLY = () => num(process.env.JSEARCH_MONTHLY_CREDITS, 180);
const MAX_QUERIES = () => num(process.env.JSEARCH_MAX_QUERIES, 6);
const MIN_HOURS = () => num(process.env.JSEARCH_MIN_HOURS, 24);
const PAGES = () => Math.min(20, Math.max(1, num(process.env.JSEARCH_PAGES, 1)));

// ── Building searches from a CV ───────────────────────────────────────────────
const GENERIC = /^(intern|internship|assistant|associate|officer|executive|staff|employee|consultant|freelancer|founder|co-founder|ceo|owner|manager)$/i;

/** "Assistant Manager, NDMA" → "assistant manager"; "Full Stack Developer | AI Engineer" → "full stack developer" */
export function cleanTitle(t) {
  let s = String(t || '').toLowerCase()
    .split(/\s*[,|•–—(@]\s*|\s+-\s+|\s+at\s+/)[0]
    .replace(/[^a-z0-9+#./ ]/g, ' ')
    .replace(/\b(senior|sr|junior|jr|lead|head|principal|trainee)\b\.?/g, '')
    .replace(/\s+/g, ' ').trim();
  const words = s.split(' ');
  if (words.length > 5) s = words.slice(0, 5).join(' ');
  return s.length >= 3 && !GENERIC.test(s) ? s : '';
}

/** Searches for one user: [{ q, remote }] */
export function queriesForUser(u) {
  const roles = [...new Set((u.titles || []).map(cleanTitle).filter(Boolean))].slice(0, 2);
  if (!roles.length) {
    // No usable titles: search by the strongest skills instead
    for (const s of (u.skills || []).slice(0, 2)) roles.push(`${s} jobs`);
  }
  const prefs = (u.pref_locations || []).map((l) => l.trim()).filter(Boolean);
  const isRemote = (l) => /remote|anywhere|worldwide/i.test(l);
  const wantsRemote = prefs.some(isRemote) || (u.pref_categories || []).includes('remote');
  const places = prefs.filter((l) => !isRemote(l)).slice(0, 2);
  if (!places.length) places.push('Pakistan');

  const out = [];
  for (const role of roles) {
    for (const p of places) out.push({ q: `${role} in ${p}`, remote: false });
    if (wantsRemote) out.push({ q: `remote ${role}`, remote: true });
  }
  return out;
}

const keyOf = ({ q, remote }) => `${remote ? 'R' : 'L'}:${q.toLowerCase()}`;

// ── Credit budget ─────────────────────────────────────────────────────────────
const month = () => new Date().toISOString().slice(0, 7);

/** Atomically reserve credits; false when the monthly cap would be exceeded. */
async function takeCredits(n) {
  if (n > MONTHLY()) return false;
  const { rowCount } = await query(
    `INSERT INTO api_usage (source, month, calls) VALUES ('jsearch', $1, $2)
     ON CONFLICT (source, month) DO UPDATE SET calls = api_usage.calls + $2
       WHERE api_usage.calls + $2 <= $3`,
    [month(), n, MONTHLY()]
  );
  return rowCount > 0;
}

export async function creditsUsed() {
  const { rows } = await query(`SELECT calls FROM api_usage WHERE source = 'jsearch' AND month = $1`, [month()]);
  return { used: rows[0]?.calls || 0, cap: MONTHLY(), month: month() };
}

async function isFresh(key) {
  const { rows } = await query(
    `SELECT 1 FROM search_queries WHERE source = 'jsearch' AND q = $1 AND last_run > now() - ($2 || ' hours')::interval`,
    [key, MIN_HOURS()]
  );
  return rows.length > 0;
}

// ── Calling the API ───────────────────────────────────────────────────────────
function normalize(j) {
  const exp = j.job_offer_expiration_datetime_utc;
  const govt = /government|ministry|authority|commission|federal|provincial|wapda|pakistan army|navy|air force|police|psc\b/i.test(`${j.employer_name} ${j.job_title}`);
  return {
    external_id: j.job_id,
    title: j.job_title,
    company: j.employer_name,
    location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || (j.job_is_remote ? 'Remote' : 'Pakistan'),
    country: j.job_country === 'PK' ? 'PK' : 'INTL',
    category: govt ? 'govt' : j.job_is_remote ? 'remote' : 'private',
    is_remote: !!j.job_is_remote,
    description: j.job_description?.slice(0, 10000),
    tags: [j.job_employment_type, j.job_publisher].filter(Boolean),
    salary: j.job_min_salary ? `${j.job_salary_currency || ''} ${j.job_min_salary}–${j.job_max_salary} ${j.job_salary_period || ''}`.trim() : null,
    url: j.job_apply_link || j.job_google_link,
    posted_at: j.job_posted_at_datetime_utc,
    deadline: exp ? exp.slice(0, 10) : toISODate(extractDeadline(j.job_description)),
    // Google Jobs gives the employer's country; remote roles there are normally limited to it
    restriction_codes: j.job_is_remote && j.job_country && j.job_country !== 'PK' ? [j.job_country] : [],
  };
}

export class QuotaError extends Error {}

/** Run one search if not done recently and budget allows. Returns normalized jobs ([] if skipped). */
export async function runSearch(s) {
  const key = keyOf(s);
  if (await isFresh(key)) return [];
  const pages = PAGES();
  if (!(await takeCredits(pages))) throw new QuotaError(`monthly credit cap reached (${MONTHLY()})`);

  const params = new URLSearchParams({ query: s.q, num_pages: String(pages), date_posted: 'month' });
  if (s.remote) params.set('work_from_home', 'true');
  else params.set('country', 'pk');
  let data;
  try {
    data = await getJSON(`https://jsearch.p.rapidapi.com/search?${params}`, {
      headers: { 'x-rapidapi-key': config.rapidApiKey, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' },
      timeout: 45000,
    });
  } catch (e) {
    if (/\b(403|429)\b/.test(e.message)) throw new QuotaError(e.message); // not subscribed / RapidAPI quota used up
    throw e;
  }
  await query(
    `INSERT INTO search_queries (source, q, last_run) VALUES ('jsearch', $1, now())
     ON CONFLICT (source, q) DO UPDATE SET last_run = now()`, [key]);
  // Response is { data: [jobs] } (older) or { data: { jobs: [...], cursor } } (newer)
  const list = Array.isArray(data.data) ? data.data : data.data?.jobs || data.data?.results || [];
  console.log(`[jsearch] "${s.q}"${s.remote ? ' (remote)' : ''}: ${list.length} jobs`);
  return list.map(normalize);
}

/** All CV-derived searches across users, most-requested first. */
export async function plannedSearches() {
  const { rows: users } = await query(
    `SELECT titles, skills, pref_locations, pref_categories FROM users
      WHERE coalesce(array_length(titles, 1), 0) > 0 OR coalesce(array_length(skills, 1), 0) > 0`);
  const tally = new Map();
  for (const u of users) for (const s of queriesForUser(u)) {
    const k = keyOf(s);
    const t = tally.get(k) || { ...s, users: 0 };
    t.users++;
    tally.set(k, t);
  }
  let list = [...tally.values()].sort((a, b) => b.users - a.users);
  if (!list.length && process.env.JSEARCH_FALLBACK_QUERIES) {
    list = process.env.JSEARCH_FALLBACK_QUERIES.split('|').map((q) => q.trim()).filter(Boolean).map((q) => ({ q, remote: /remote/i.test(q) }));
  }
  return list;
}

export const jsearch = {
  name: 'jsearch', label: 'Google Jobs (JSearch) — searches built from users’ CVs', homepage: 'https://rapidapi.com',
  enabled: () => !!config.rapidApiKey,
  async fetch() {
    const out = [];
    let ran = 0;
    for (const s of await plannedSearches()) {
      if (ran >= MAX_QUERIES()) break;
      if (await isFresh(keyOf(s))) continue; // ran recently (e.g. right after that user's CV upload)
      try {
        ran++;
        out.push(...(await runSearch(s)));
      } catch (e) {
        if (e instanceof QuotaError) { console.warn(`[jsearch] stopping: ${e.message}`); break; }
        console.warn(`[jsearch] "${s.q}": ${e.message}`);
      }
    }
    return out;
  },
};
