import { findSkills, findExperienceYears } from './skills.js';

const STOP = new Set(['senior', 'junior', 'jr', 'sr', 'lead', 'the', 'and', 'of', 'for', 'a', 'an', 'in', 'at', 'to', 'officer', 'assistant', 'associate', 'staff', 'level', 'i', 'ii', 'iii']);
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1 && !STOP.has(w));

/**
 * Score how well a job matches a user profile. 0–100.
 *  - 55% skill overlap (job skills found in user's skills)
 *  - 25% title similarity (user's past/desired titles vs job title)
 *  - 10% experience fit
 *  - 10% preference fit (location / category)
 */
export function scoreJob(job, profile) {
  const userSkills = new Set(profile.skills || []);
  const jobText = `${job.title} ${(job.tags || []).join(' ')} ${job.description || ''}`;
  const jobSkills = job._skills || findSkills(jobText);

  let skillScore = 0;
  const matched = jobSkills.filter((s) => userSkills.has(s));
  if (jobSkills.length) skillScore = matched.length / Math.min(jobSkills.length, 8);
  else skillScore = 0.15; // unknown requirements → small baseline
  skillScore = Math.min(1, skillScore);

  // Title similarity: Jaccard on words
  const jt = new Set(words(job.title));
  let titleScore = 0;
  for (const t of profile.titles || []) {
    const ut = new Set(words(t));
    const inter = [...ut].filter((w) => jt.has(w)).length;
    const union = new Set([...ut, ...jt]).size || 1;
    titleScore = Math.max(titleScore, inter / union);
  }
  // Skill names appearing in the title are a strong signal
  if (matched.some((s) => job.title.toLowerCase().includes(s))) titleScore = Math.max(titleScore, 0.6);

  const need = findExperienceYears(job.description);
  const have = profile.experience_years;
  let expScore = 0.7;
  if (need != null && have != null) expScore = have >= need ? 1 : have >= need - 1 ? 0.7 : have >= need - 3 ? 0.35 : 0.1;

  let prefScore = 0.5;
  const locs = (profile.pref_locations || []).map((l) => l.toLowerCase());
  const cats = profile.pref_categories || [];
  if (locs.length || cats.length) {
    prefScore = 0;
    if (cats.includes(job.category)) prefScore += 0.5;
    const loc = `${job.location || ''} ${job.is_remote ? 'remote' : ''}`.toLowerCase();
    if (locs.some((l) => loc.includes(l))) prefScore += 0.5;
    if (!cats.length) prefScore += 0.25;
    if (!locs.length) prefScore += 0.25;
  }

  const score = Math.round(100 * (0.55 * skillScore + 0.25 * titleScore + 0.1 * expScore + 0.1 * prefScore));
  return { score, matchedSkills: matched, missingSkills: jobSkills.filter((s) => !userSkills.has(s)).slice(0, 6) };
}
