// Generic scraper for Pakistani government / testing-service listing pages.
// Each site in pk-sites.json is a page that lists advertisements. Instead of brittle per-site CSS
// selectors, we look at every link, take its "row" (table row / list item / card), keep rows that look
// like job ads, and pull the closing date from the row text. Site layouts change often — when one
// stops producing jobs, check /api/admin/sources and adjust its URL or add a `selector` override.
import * as cheerio from 'cheerio';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getText, absUrl } from '../lib/http.js';
import { extractDeadline, parseDateLoose, toISODate } from '../lib/deadline.js';
import { config } from '../config.js';

const SITES = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'pk-sites.json'), 'utf8'));

const JOBISH = /(post|posts|position|vacanc|recruit|advertis|advt|jobs?\b|bs-?\s?\d{1,2}|bps-?\s?\d{1,2}|officer|assistant|lecturer|inspector|engineer|clerk|constable|teacher|manager|director|consultant|internship)/i;
const NAVISH = /^(home|about|contact|login|sign ?in|register|faq|downloads?|news|gallery|tenders?|results?|merit list|syllabus|apply online|more|read more|click here|view all|next|previous)$/i;
const DATE_ANY = /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,\s]+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi;

const robotsCache = new Map();
export async function allowedByRobots(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    let rules = [];
    try {
      const txt = await getText(`${u.origin}/robots.txt`, { timeout: 8000 });
      let applies = false;
      for (const line of txt.split('\n')) {
        const [k, ...rest] = line.split(':');
        const v = rest.join(':').trim();
        if (/^user-agent$/i.test(k.trim())) applies = v === '*' || /jobradar/i.test(v);
        else if (applies && /^disallow$/i.test(k.trim()) && v) rules.push(v);
      }
    } catch { /* no robots.txt → allowed */ }
    robotsCache.set(u.origin, rules);
  }
  return !robotsCache.get(u.origin).some((p) => u.pathname.startsWith(p));
}

/** Pick the closing date from a table row / card: an explicit "last date" cue wins, else the latest future date. */
function rowDeadline(text, now = new Date()) {
  const cued = extractDeadline(text, now);
  if (cued) return cued;
  const dates = (text.match(DATE_ANY) || []).map((s) => parseDateLoose(s, now)).filter(Boolean);
  const future = dates.filter((d) => d.getTime() >= now.getTime() - 86400000);
  // Rows typically hold [published date, closing date]; closing is the later one.
  return future.length && dates.length >= 2 ? future.sort((a, b) => b - a)[0] : null;
}

export function parseListing(html, site, now = new Date()) {
  const $ = cheerio.load(html);
  $('script,style,noscript,header nav,footer').remove();
  const seen = new Set();
  const jobs = [];
  const scope = site.selector ? $(site.selector) : $('body');
  scope.find('a[href]').each((_, a) => {
    const $a = $(a);
    const href = absUrl($a.attr('href'), site.url);
    if (!href || href.startsWith('javascript') || href.includes('#') && href.split('#')[0] === site.url) return;
    const linkText = $a.text().replace(/\s+/g, ' ').trim();
    if (NAVISH.test(linkText)) return;
    const $row = $a.closest('tr, li, article, .card, .job, .views-row, .item, p');
    const rowText = ($row.length ? $row.text() : linkText).replace(/\s+/g, ' ').trim();
    if (rowText.length > 700) return; // container, not a row
    if (!JOBISH.test(rowText)) return;
    const key = href + '|' + rowText.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);

    // Title: prefer the meaningful link text, else the row text without dates
    let title = linkText.length >= 12 && !/^(download|view|details|apply|pdf)/i.test(linkText) ? linkText : rowText.replace(DATE_ANY, '').replace(/\s+/g, ' ');
    title = title.replace(/^(\d+\s*[.)-]\s*)/, '').slice(0, 220).trim();
    if (title.length < 8) return;

    const deadline = rowDeadline(rowText, now);
    jobs.push({
      external_id: `${site.id}:${Buffer.from(href + title).toString('base64url').slice(0, 60)}`,
      title,
      company: site.org,
      location: site.location,
      country: 'PK',
      category: site.category || 'govt',
      is_remote: false,
      description: rowText,
      tags: ['Government', site.id.toUpperCase(), ...(rowText.match(/\b(BPS|BS)-?\s?\d{1,2}\b/gi) || []).map((s) => s.toUpperCase().replace(/\s/g, ''))],
      url: href,
      posted_at: null,
      deadline: toISODate(deadline),
    });
  });
  return jobs;
}

export const pkgov = {
  name: 'pkgov', label: 'Pakistan Govt (PSCs, NTS, PTS…)', homepage: 'https://njp.gov.pk',
  async fetch() {
    const all = [];
    const only = process.env.PK_SITES ? new Set(process.env.PK_SITES.split(',')) : null;
    for (const site of SITES) {
      if (only && !only.has(site.id)) continue;
      try {
        if (!(await allowedByRobots(site.url))) { console.warn(`[pkgov] ${site.id}: disallowed by robots.txt, skipping`); continue; }
        const html = await getText(site.url, { headers: { 'user-agent': config.userAgent } });
        const jobs = parseListing(html, site);
        console.log(`[pkgov] ${site.id}: ${jobs.length} rows`);
        all.push(...jobs.map((j) => ({ ...j, _site: site.id, site_domicile: site.domicile })));
      } catch (e) {
        console.warn(`[pkgov] ${site.id}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 1500)); // be polite to govt servers
    }
    return all;
  },
};
