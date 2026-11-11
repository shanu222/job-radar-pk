import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDeadline, toISODate } from '../src/lib/deadline.js';
import { findSkills, findExperienceYears } from '../src/lib/skills.js';
import { scoreJob } from '../src/lib/match.js';
import { parseListing } from '../src/sources/pkgov.js';

const ref = new Date('2026-11-11T00:00:00Z');
const d = (t) => toISODate(extractDeadline(t, ref));

test('deadline formats used in Pakistani ads', () => {
  assert.equal(d('Last date to apply: 25-11-2026'), '2026-11-25');
  assert.equal(d('Last Date for submission of applications is 05/12/2026.'), '2026-12-05');
  assert.equal(d('Closing date 30th November, 2026'), '2026-11-30');
  assert.equal(d('Deadline: December 3, 2026'), '2026-12-03');
  assert.equal(d('Apply before 2026-12-15'), '2026-12-15');
  assert.equal(d('applications close on 2 Jan'), '2027-01-02');
  assert.equal(d('Salary 50000, posted 01-11-2026'), null);
});

test('skills + experience from CV text', () => {
  const s = findSkills('Full-stack developer: React, Next.js, Node.js, PostgreSQL, Python, FastAPI, Docker. Disaster risk reduction at NDMA.');
  for (const k of ['react', 'next.js', 'node.js', 'postgresql', 'python', 'fastapi', 'docker', 'disaster management']) assert.ok(s.includes(k), k);
  assert.equal(findExperienceYears('5+ years of experience in web development'), 5);
});

test('matching ranks relevant jobs higher', () => {
  const user = { skills: ['react', 'node.js', 'typescript', 'postgresql'], titles: ['Full Stack Developer'], experience_years: 5 };
  const good = scoreJob({ title: 'Senior Full Stack Developer (React/Node)', description: 'React, Node.js, TypeScript, PostgreSQL. 4 years experience.', tags: [], category: 'remote', is_remote: true }, user);
  const bad = scoreJob({ title: 'Staff Nurse', description: 'Nursing diploma, PNC registration, 3 years experience', tags: [], category: 'govt' }, user);
  assert.ok(good.score >= 70, `good=${good.score}`);
  assert.ok(bad.score < 25, `bad=${bad.score}`);
  assert.deepEqual(good.matchedSkills.sort(), ['node.js', 'postgresql', 'react', 'typescript']);
});

test('govt listing scraper finds rows and closing dates', () => {
  const html = `<html><body><nav><a href="/">Home</a><a href="/contact">Contact</a></nav>
    <table>
      <tr><td>1</td><td><a href="/adv/12-2026.pdf">Consolidated Advertisement No. 12/2026 — Assistant Director (BS-17), Ministry of Climate Change</a></td><td>01-11-2026</td><td>28-11-2026</td></tr>
      <tr><td>2</td><td><a href="/adv/13-2026">Lecturer Computer Science (BPS-17) posts</a></td><td>Last date: 5th December 2026</td></tr>
      <tr><td>3</td><td><a href="/tenders/9">Tender for printing</a></td></tr>
    </table></body></html>`;
  const jobs = parseListing(html, { id: 'fpsc', org: 'FPSC', location: 'Pakistan', url: 'https://www.fpsc.gov.pk/jobs', category: 'govt' }, ref);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].deadline, '2026-11-28');
  assert.equal(jobs[0].url, 'https://www.fpsc.gov.pk/adv/12-2026.pdf');
  assert.ok(jobs[0].tags.includes('BS-17'));
  assert.equal(jobs[1].deadline, '2026-12-05');
});

import { cleanTitle, queriesForUser } from '../src/sources/jsearch.js';

test('JSearch searches come from the CV, not a fixed list', () => {
  assert.equal(cleanTitle('Full Stack Developer | AI Engineer'), 'full stack developer');
  assert.equal(cleanTitle('Senior Data Analyst at Systems Ltd'), 'data analyst');
  assert.equal(cleanTitle('Manager'), ''); // too generic to search on its own

  const u = { titles: ['Full Stack Developer | AI Engineer', 'Assistant Manager, Disaster Management Authority'], skills: ['react'], pref_locations: ['Islamabad', 'Remote'] };
  assert.deepEqual(queriesForUser(u), [
    { q: 'full stack developer in Islamabad', remote: false },
    { q: 'remote full stack developer', remote: true },
    { q: 'assistant manager in Islamabad', remote: false },
    { q: 'remote assistant manager', remote: true },
  ]);
  // No titles → strongest skills; no location preference → Pakistan
  assert.deepEqual(queriesForUser({ titles: [], skills: ['gis', 'python'] }), [
    { q: 'gis jobs in Pakistan', remote: false },
    { q: 'python jobs in Pakistan', remote: false },
  ]);
});

import { locationEligibility, extractDomiciles, canApplyDomicile, userTokens } from '../src/lib/eligibility.js';

const canApply = (job, country = 'PK') => locationEligibility(job).some((t) => userTokens(country).includes(t));

test('international jobs: only ones Pakistanis can really apply for', () => {
  const remote = (location, description = '') => ({ country: 'INTL', is_remote: true, location, description });
  assert.equal(canApply(remote('Worldwide')), true);
  assert.equal(canApply(remote('Anywhere in the World')), true);
  assert.equal(canApply(remote('Remote')), true);
  assert.equal(canApply(remote('USA Only')), false);
  assert.equal(canApply(remote('United States, Canada')), false);
  assert.equal(canApply(remote('Europe')), false);
  assert.equal(canApply(remote('EMEA')), false);
  assert.equal(canApply(remote('APAC')), true);
  assert.equal(canApply(remote('Asia')), true);
  assert.equal(canApply(remote('Pakistan, India, Bangladesh')), true);
  assert.equal(canApply(remote('Remote', 'You must be located in the United States. Only US residents.')), false);
  assert.equal(canApply(remote('Remote', 'Work hours overlap with UTC+3 to UTC+8.')), true);
  assert.equal(canApply(remote('Remote', 'Candidates in UTC-8 to UTC-3 time zones only.')), false);
  assert.equal(canApply(remote('Berlin')), false); // remote within Germany
  assert.equal(canApply({ country: 'INTL', is_remote: true, location: 'Austin, TX, US', restriction_codes: ['US'] }), false); // JSearch US remote
  // On-site abroad: only with visa sponsorship
  assert.equal(canApply({ country: 'INTL', is_remote: false, location: 'Berlin, Germany', description: 'Great team.' }), false);
  assert.equal(canApply({ country: 'INTL', is_remote: false, location: 'Berlin, Germany', description: 'Visa sponsorship is available and relocation support provided.' }), true);
  assert.equal(canApply({ country: 'INTL', is_remote: false, location: 'Dubai', description: 'We do not offer visa sponsorship.' }), false);
  // Pakistani jobs
  assert.equal(canApply({ country: 'PK', is_remote: false, location: 'Lahore' }), true);
  assert.equal(canApply({ country: 'PK', is_remote: false, location: 'Lahore' }, 'GB'), false);
  // Someone in the UK sees Europe/EMEA jobs
  assert.equal(canApply(remote('EMEA'), 'GB'), true);
});

test('government jobs: domicile from the ad and the commission', () => {
  assert.deepEqual(extractDomiciles('Candidates having domicile of Punjab may apply', null), ['punjab']);
  assert.deepEqual(extractDomiciles('Lecturer (BS-17). Domicile: Sindh (Urban)', null).sort(), ['sindh']);
  assert.deepEqual(extractDomiciles('Posts reserved for KPK and Balochistan domicile holders', null).sort(), ['balochistan', 'kp']);
  assert.deepEqual(extractDomiciles('Recruitment on all Pakistan basis', 'punjab'), ['ALL']);
  assert.deepEqual(extractDomiciles('Assistant Director (BS-17)', 'sindh'), ['sindh']); // SPSC default
  assert.deepEqual(extractDomiciles('Assistant Director (BS-17)', undefined), []);      // FPSC: not stated
  assert.equal(canApplyDomicile(['punjab'], 'sindh'), false);
  assert.equal(canApplyDomicile(['punjab'], 'punjab'), true);
  assert.equal(canApplyDomicile(['ALL'], 'gb'), true);
  assert.equal(canApplyDomicile([], 'gb'), true);
});
