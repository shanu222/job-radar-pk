export const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem('jr_token'));

export async function api(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  const token = auth ? getToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const qs = (o) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== false)).toString();

export const CATEGORY = {
  govt: { label: 'Government', cls: 'bg-brand-tint text-brand-dark' },
  private: { label: 'Private / NGO', cls: 'bg-sky-50 text-sky-800' },
  remote: { label: 'Remote', cls: 'bg-violet-50 text-violet-800' },
  freelance: { label: 'Freelance', cls: 'bg-amber-50 text-amber-800' },
};

export const SOURCE_LABEL = {
  pkgov: 'Govt portal', jsearch: 'Google Jobs', reliefweb: 'ReliefWeb', remotive: 'Remotive', remoteok: 'Remote OK',
  arbeitnow: 'Arbeitnow', jobicy: 'Jobicy', himalayas: 'Himalayas', rss: 'RSS', reddit: 'Reddit',
};

export function timeAgo(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '');
