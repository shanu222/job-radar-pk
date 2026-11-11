// Runs a user's own CV-based searches right after they upload a CV or change their titles/locations,
// so they see LinkedIn/Indeed/Rozee results for themselves straight away instead of waiting for the
// next scheduled run. Uses the same monthly credit cap as the scheduler.
import { config } from '../config.js';
import { queriesForUser, runSearch, QuotaError } from '../sources/jsearch.js';
import { saveJobs } from './ingest.js';

const PER_USER = () => Number(process.env.JSEARCH_PER_USER_QUERIES || 2);
const inFlight = new Set();

export async function searchForUser(user) {
  if (!config.rapidApiKey || inFlight.has(user.id)) return 0;
  inFlight.add(user.id);
  let saved = 0;
  try {
    for (const s of queriesForUser(user).slice(0, PER_USER())) {
      try {
        const jobs = await runSearch(s); // skipped automatically if this exact search ran recently
        if (jobs.length) saved += await saveJobs('jsearch', jobs);
      } catch (e) {
        console.warn(`[jsearch:user ${user.id}] "${s.q}": ${e.message}`);
        if (e instanceof QuotaError) break;
      }
    }
  } finally {
    inFlight.delete(user.id);
  }
  return saved;
}
