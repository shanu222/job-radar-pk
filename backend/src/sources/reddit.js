// Reddit hiring posts. Uses Reddit's official OAuth (app-only) when REDDIT_CLIENT_ID/SECRET
// are set — strongly recommended on Railway because Reddit blocks most anonymous cloud traffic.
// Create a "script" app at https://www.reddit.com/prefs/apps to get the credentials.
import { config } from '../config.js';
import { getJSON } from '../lib/http.js';
import { extractDeadline, toISODate } from '../lib/deadline.js';

const SUBS = (process.env.REDDIT_SUBREDDITS ||
  'forhire,hiring,remotejs,jobbit,freelance_forhire,PakistanJobs,pakistan,Islamabad,karachi,lahore').split(',').map((s) => s.trim());

const PK_SUBS = new Set(['pakistanjobs', 'pakistan', 'islamabad', 'karachi', 'lahore']);
const HIRING = /\[\s*hiring\s*\]|\bwe('re| are) hiring\b|\bhiring\b|\bjob opening\b|\bvacanc(y|ies)\b|\blooking for an? .*(developer|designer|engineer|editor|writer|manager)/i;
const NOT_HIRING = /\[\s*for\s*hire\s*\]|\blooking for (a )?(job|work)\b|\bhire me\b/i;

let token = null, tokenExp = 0;
async function getToken() {
  const id = process.env.REDDIT_CLIENT_ID, secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && Date.now() < tokenExp) return token;
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded', 'user-agent': config.userAgent },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  token = data.access_token; tokenExp = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}

export const reddit = {
  name: 'reddit', label: 'Reddit', homepage: 'https://www.reddit.com',
  async fetch() {
    const t = await getToken();
    const base = t ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
    const headers = t ? { authorization: `Bearer ${t}` } : {};
    const out = [];
    for (const sub of SUBS) {
      try {
        const isPk = PK_SUBS.has(sub.toLowerCase());
        // For general PK subs only pull posts that look like hiring posts
        const path = isPk && sub.toLowerCase() !== 'pakistanjobs'
          ? `/r/${sub}/search.json?q=hiring%20OR%20vacancy%20OR%20%22job%20opening%22&restrict_sr=1&sort=new&t=month&limit=50`
          : `/r/${sub}/new.json?limit=75`;
        const data = await getJSON(base + path, { headers });
        for (const { data: p } of data.data?.children || []) {
          const text = `${p.title}\n${p.selftext || ''}`;
          if (NOT_HIRING.test(p.title) || !HIRING.test(text)) continue;
          if (p.over_18 || p.removed_by_category) continue;
          const remote = /remote|anywhere|wfh|work from home/i.test(text);
          out.push({
            external_id: p.id,
            title: p.title.replace(/\[\s*hiring\s*\]\s*/i, '').slice(0, 200),
            company: `u/${p.author}`,
            location: remote ? 'Remote' : isPk ? 'Pakistan' : (p.link_flair_text || 'See post'),
            country: isPk ? 'PK' : 'INTL',
            category: 'freelance',
            is_remote: remote,
            description: (p.selftext || '').slice(0, 8000),
            tags: [`r/${sub}`, p.link_flair_text].filter(Boolean),
            url: `https://www.reddit.com${p.permalink}`,
            posted_at: new Date(p.created_utc * 1000).toISOString(),
            deadline: toISODate(extractDeadline(text)),
          });
        }
      } catch (e) {
        console.warn(`[reddit] r/${sub}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 1100)); // stay well under rate limits
    }
    return out;
  },
};
