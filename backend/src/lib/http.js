import { config } from '../config.js';

export async function getJSON(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'user-agent': config.userAgent, accept: 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(opts.timeout || 25000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

export async function getText(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'user-agent': config.userAgent, accept: 'text/html,application/xhtml+xml,*/*', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(opts.timeout || 25000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·' };
const decodeEntities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** HTML (possibly entity-encoded HTML, as some boards send) → clean plain text with line breaks. */
export const stripHtml = (html) => {
  let s = String(html || '');
  // Encoded markup like "&lt;div&gt;" → decode first so the tags can be removed
  for (let i = 0; i < 2 && /&lt;\/?[a-z]/i.test(s); i++) s = decodeEntities(s);
  s = s
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<(br|\/p|\/li|\/div|\/h\d|\/tr|\/ul|\/ol)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(s)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const absUrl = (href, base) => {
  try { return new URL(href, base).toString(); } catch { return null; }
};
