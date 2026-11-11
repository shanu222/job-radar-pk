// Generic RSS/Atom job feeds. Add more with RSS_FEEDS="label|url|category|country;label2|url2|..."
import Parser from 'rss-parser';
import { stripHtml } from '../lib/http.js';
import { extractDeadline, toISODate } from '../lib/deadline.js';
import { config } from '../config.js';

const DEFAULT_FEEDS = [
  ['We Work Remotely — Programming', 'https://weworkremotely.com/categories/remote-programming-jobs.rss', 'remote', 'INTL'],
  ['We Work Remotely — Design', 'https://weworkremotely.com/categories/remote-design-jobs.rss', 'remote', 'INTL'],
  ['We Work Remotely — Marketing', 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss', 'remote', 'INTL'],
  ['We Work Remotely — Customer Support', 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss', 'remote', 'INTL'],
];

function feeds() {
  const extra = (process.env.RSS_FEEDS || '').split(';').filter(Boolean).map((s) => s.split('|').map((x) => x.trim()));
  return [...DEFAULT_FEEDS, ...extra];
}

const parser = new Parser({ timeout: 20000, headers: { 'user-agent': config.userAgent } });

export const rss = {
  name: 'rss', label: 'RSS feeds', homepage: 'https://weworkremotely.com',
  async fetch() {
    const out = [];
    for (const [label, url, category = 'remote', country = 'INTL'] of feeds()) {
      try {
        const feed = await parser.parseURL(url);
        for (const it of feed.items || []) {
          const description = stripHtml(it.content || it['content:encoded'] || it.contentSnippet || '');
          // WWR titles look like "Company: Job title"
          const [maybeCompany, ...rest] = (it.title || '').split(': ');
          const hasCompany = rest.length > 0;
          out.push({
            external_id: it.guid || it.link,
            title: hasCompany ? rest.join(': ') : it.title,
            company: hasCompany ? maybeCompany : label,
            location: it.region || (category === 'remote' ? 'Remote' : ''),
            country, category, is_remote: category === 'remote',
            description: description.slice(0, 10000),
            tags: [label, ...(it.categories || [])].filter(Boolean).slice(0, 8),
            url: it.link,
            posted_at: it.isoDate || null,
            deadline: toISODate(extractDeadline(description)),
          });
        }
      } catch (e) {
        console.warn(`[rss] ${label}: ${e.message}`);
      }
    }
    return out;
  },
};
