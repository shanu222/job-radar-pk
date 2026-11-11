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

export const stripHtml = (html) =>
  String(html || '')
    .replace(/<(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

export const absUrl = (href, base) => {
  try { return new URL(href, base).toString(); } catch { return null; }
};
