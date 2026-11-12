export const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem('jr_token'));

export async function api(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  const token = auth ? getToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw Object.assign(new Error('Can’t reach the server. Check your internet connection and try again.'), { userFacing: true, status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Our API's error messages are written for users; anything unexpected gets a generic message
    const msg = data.error && res.status < 500 ? data.error
      : res.status === 429 ? 'Too many requests. Please wait a moment and try again.'
      : res.status >= 500 ? 'Something went wrong on our side. Please try again in a minute.'
      : 'Something went wrong. Please try again.';
    throw Object.assign(new Error(msg), { status: res.status, userFacing: true, data });
  }
  return data;
}

export const qs = (o) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== false)).toString();

// Category is shown as plain text; colour is kept for deadlines and matches
export const CATEGORY = {
  govt: { label: 'Government', cls: 'bg-paper text-ink' },
  private: { label: 'Private / NGO', cls: 'bg-paper text-ink' },
  remote: { label: 'Remote', cls: 'bg-paper text-ink' },
  freelance: { label: 'Freelance', cls: 'bg-paper text-ink' },
};

export const SOURCE_LABEL = {
  pkgov: 'Commission website', jsearch: 'Google Jobs', reliefweb: 'ReliefWeb', remotive: 'Remotive', remoteok: 'Remote OK',
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
