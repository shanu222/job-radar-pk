// International remote job boards with free public APIs.
// Please keep the "via <source>" attribution in the UI — several of these APIs require it.
import { getJSON, stripHtml } from '../lib/http.js';
import { extractDeadline, toISODate } from '../lib/deadline.js';

const intl = (o) => ({ country: 'INTL', category: 'remote', is_remote: true, ...o });
const dl = (text) => toISODate(extractDeadline(text));

export const remotive = {
  name: 'remotive', label: 'Remotive', homepage: 'https://remotive.com',
  async fetch() {
    const data = await getJSON('https://remotive.com/api/remote-jobs?limit=300');
    return data.jobs.map((j) => {
      const description = stripHtml(j.description);
      return intl({
        external_id: String(j.id), title: j.title, company: j.company_name,
        location: j.candidate_required_location || 'Remote', description,
        tags: [j.category, j.job_type, ...(j.tags || [])].filter(Boolean),
        salary: j.salary || null, url: j.url, posted_at: j.publication_date, deadline: dl(description),
      });
    });
  },
};

export const remoteok = {
  name: 'remoteok', label: 'Remote OK', homepage: 'https://remoteok.com',
  async fetch() {
    const data = await getJSON('https://remoteok.com/api');
    return data.filter((j) => j.id && j.position).map((j) => {
      const description = stripHtml(j.description);
      return intl({
        external_id: String(j.id), title: j.position, company: j.company,
        location: j.location || 'Remote', description, tags: j.tags || [],
        salary: j.salary_min ? `$${j.salary_min.toLocaleString()} – $${(j.salary_max || j.salary_min).toLocaleString()}` : null,
        url: j.url || `https://remoteok.com/remote-jobs/${j.slug}`, posted_at: j.date, deadline: dl(description),
      });
    });
  },
};

export const arbeitnow = {
  name: 'arbeitnow', label: 'Arbeitnow', homepage: 'https://www.arbeitnow.com',
  async fetch() {
    const out = [];
    for (let page = 1; page <= 3; page++) {
      const data = await getJSON(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
      for (const j of data.data || []) {
        const description = stripHtml(j.description);
        out.push({
          external_id: j.slug, title: j.title, company: j.company_name, location: j.location,
          country: 'INTL', category: j.remote ? 'remote' : 'private', is_remote: !!j.remote,
          region_hint: ['EUROPE'], // Arbeitnow is a German board: "remote" almost always means within Europe
          description, tags: [...(j.tags || []), ...(j.job_types || [])], url: j.url,
          posted_at: new Date(j.created_at * 1000).toISOString(), deadline: dl(description),
        });
      }
      if (!data.links?.next) break;
    }
    return out;
  },
};

export const jobicy = {
  name: 'jobicy', label: 'Jobicy', homepage: 'https://jobicy.com',
  async fetch() {
    const data = await getJSON('https://jobicy.com/api/v2/remote-jobs?count=100');
    return (data.jobs || []).map((j) => {
      const description = stripHtml(j.jobDescription);
      return intl({
        external_id: String(j.id), title: stripHtml(j.jobTitle), company: j.companyName,
        location: j.jobGeo || 'Remote', description,
        tags: [...[].concat(j.jobIndustry || []), ...[].concat(j.jobType || [])].map(stripHtml),
        salary: j.annualSalaryMin ? `${j.salaryCurrency || '$'} ${j.annualSalaryMin}–${j.annualSalaryMax}/yr` : null,
        url: j.url, posted_at: j.pubDate, deadline: dl(description),
      });
    });
  },
};

export const himalayas = {
  name: 'himalayas', label: 'Himalayas', homepage: 'https://himalayas.app',
  async fetch() {
    const out = [];
    for (let offset = 0; offset < 400; offset += 100) {
      const data = await getJSON(`https://himalayas.app/jobs/api?limit=100&offset=${offset}`);
      const jobs = data.jobs || [];
      for (const j of jobs) {
        const description = stripHtml(j.description || j.excerpt);
        // Himalayas exposes a real expiry date → use it as the deadline
        const expiry = j.expiryDate ? toISODate(new Date(j.expiryDate * 1000)) : null;
        out.push(intl({
          external_id: j.guid || j.applicationLink, title: j.title, company: j.companyName,
          location: (j.locationRestrictions || []).join(', ') || 'Worldwide', description,
          tags: [...(j.categories || []), j.employmentType, j.seniority].flat().filter(Boolean),
          salary: j.minSalary ? `${j.currency || '$'} ${j.minSalary}–${j.maxSalary}` : null,
          url: j.applicationLink, posted_at: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
          deadline: expiry || dl(description),
        }));
      }
      if (jobs.length < 100) break;
    }
    return out;
  },
};
