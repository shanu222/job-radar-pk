// ReliefWeb (UN OCHA) — UN, INGO and NGO jobs, with real closing dates.
// Excellent for Pakistan development/humanitarian sector. Requires a free approved appname:
// https://apidoc.reliefweb.int/parameters#appname  → set RELIEFWEB_APPNAME
import { stripHtml } from '../lib/http.js';
import { config } from '../config.js';

const COUNTRIES = (process.env.RELIEFWEB_COUNTRIES || 'Pakistan').split(',').map((s) => s.trim());

export const reliefweb = {
  name: 'reliefweb', label: 'ReliefWeb (UN/NGO)', homepage: 'https://reliefweb.int/jobs',
  enabled: () => !!process.env.RELIEFWEB_APPNAME,
  async fetch() {
    const appname = process.env.RELIEFWEB_APPNAME;
    const body = {
      profile: 'full', limit: 200, sort: ['date.created:desc'],
      filter: {
        operator: 'OR',
        conditions: [
          { field: 'country.name', value: COUNTRIES, operator: 'OR' },
          ...(process.env.RELIEFWEB_INCLUDE_HOMEBASED === 'true' ? [{ field: 'city.name', value: ['Home-based', 'Remote'], operator: 'OR' }] : []),
        ],
      },
    };
    const res = await fetch(`https://api.reliefweb.int/v2/jobs?appname=${encodeURIComponent(appname)}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': config.userAgent }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`ReliefWeb ${res.status}`);
    const data = await res.json();
    return (data.data || []).map(({ id, fields: f }) => {
      const pk = (f.country || []).some((c) => c.name === 'Pakistan');
      const city = (f.city || []).map((c) => c.name).join(', ');
      const remote = /home-based|remote/i.test(city);
      return {
        external_id: String(id), title: f.title, company: f.source?.[0]?.shortname || f.source?.[0]?.name,
        location: [city, (f.country || []).map((c) => c.name).join(', ')].filter(Boolean).join(', '),
        country: pk ? 'PK' : 'INTL', category: 'private', is_remote: remote,
        description: stripHtml(f['body-html'] || f.body || '').slice(0, 10000),
        tags: ['UN/NGO', ...(f.career_categories || []).map((c) => c.name), ...(f.experience || []).map((e) => e.name)],
        url: f.url_alias || f.url, posted_at: f.date?.created, deadline: f.date?.closing?.slice(0, 10) || null,
      };
    });
  },
};
