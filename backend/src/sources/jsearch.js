// JSearch (RapidAPI) = Google for Jobs data. This is the best single source for Pakistani
// PRIVATE-sector jobs, because Google already indexes Rozee.pk, LinkedIn, Indeed, Mustakbil,
// company career pages etc. Free tier ≈ 200 requests/month → keep queries few and run 1–2×/day.
// Get a key: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
import { config } from '../config.js';
import { getJSON } from '../lib/http.js';
import { extractDeadline, toISODate } from '../lib/deadline.js';

const QUERIES = (process.env.JSEARCH_QUERIES ||
  'jobs in Islamabad|jobs in Lahore|jobs in Karachi|software jobs in Pakistan|government jobs in Pakistan|NGO jobs in Pakistan').split('|');

let lastRun = 0;
const MIN_INTERVAL = Number(process.env.JSEARCH_MIN_HOURS || 12) * 3600000;

export const jsearch = {
  name: 'jsearch', label: 'Google Jobs (JSearch)', homepage: 'https://rapidapi.com',
  enabled: () => !!config.rapidApiKey,
  async fetch() {
    if (Date.now() - lastRun < MIN_INTERVAL) return []; // protect free quota
    lastRun = Date.now();
    const out = [];
    for (const q of QUERIES) {
      const data = await getJSON(
        `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=2&country=pk&date_posted=week`,
        { headers: { 'x-rapidapi-key': config.rapidApiKey, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' } }
      );
      for (const j of data.data || []) {
        const exp = j.job_offer_expiration_datetime_utc;
        const govt = /government|ministry|authority|commission|federal|provincial|wapda|pakistan army|navy|air force|police|psc\b/i.test(`${j.employer_name} ${j.job_title}`);
        out.push({
          external_id: j.job_id,
          title: j.job_title,
          company: j.employer_name,
          location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || 'Pakistan',
          country: j.job_country === 'PK' ? 'PK' : 'INTL',
          category: govt ? 'govt' : j.job_is_remote ? 'remote' : 'private',
          is_remote: !!j.job_is_remote,
          description: j.job_description?.slice(0, 10000),
          tags: [j.job_employment_type, j.job_publisher].filter(Boolean),
          salary: j.job_min_salary ? `${j.job_salary_currency || ''} ${j.job_min_salary}–${j.job_max_salary} ${j.job_salary_period || ''}`.trim() : null,
          url: j.job_apply_link || j.job_google_link,
          posted_at: j.job_posted_at_datetime_utc,
          deadline: exp ? exp.slice(0, 10) : toISODate(extractDeadline(j.job_description)),
        });
      }
    }
    return out;
  },
};
