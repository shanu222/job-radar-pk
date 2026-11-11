// Keep in sync with backend/src/lib/eligibility.js
export const PROVINCES = [
  ['punjab', 'Punjab'], ['sindh', 'Sindh'], ['kp', 'Khyber Pakhtunkhwa'], ['balochistan', 'Balochistan'],
  ['ict', 'Islamabad (ICT)'], ['gb', 'Gilgit-Baltistan'], ['ajk', 'Azad Jammu & Kashmir'], ['merged', 'Merged Districts (ex-FATA)'],
];
export const PROVINCE_NAME = Object.fromEntries(PROVINCES);

export const COUNTRIES = [
  ['PK', 'Pakistan'], ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['QA', 'Qatar'], ['KW', 'Kuwait'], ['OM', 'Oman'], ['BH', 'Bahrain'],
  ['GB', 'United Kingdom'], ['US', 'United States'], ['CA', 'Canada'], ['AU', 'Australia'], ['NZ', 'New Zealand'], ['IE', 'Ireland'],
  ['DE', 'Germany'], ['FR', 'France'], ['NL', 'Netherlands'], ['IT', 'Italy'], ['ES', 'Spain'], ['SE', 'Sweden'], ['TR', 'Turkey'],
  ['MY', 'Malaysia'], ['SG', 'Singapore'], ['CN', 'China'], ['JP', 'Japan'], ['PH', 'Philippines'], ['ID', 'Indonesia'],
  ['IN', 'India'], ['BD', 'Bangladesh'], ['LK', 'Sri Lanka'], ['NP', 'Nepal'], ['AF', 'Afghanistan'],
  ['EG', 'Egypt'], ['NG', 'Nigeria'], ['KE', 'Kenya'], ['ZA', 'South Africa'],
];
export const COUNTRY_NAME = Object.fromEntries(COUNTRIES);

const REGION_LABEL = { WORLD: 'Worldwide', ASIA: 'Asia', SOUTH_ASIA: 'South Asia', APAC: 'Asia-Pacific', MENA: 'Middle East', EMEA: 'EMEA', EUROPE: 'Europe', AMERICAS: 'Americas', AFRICA: 'Africa', OCEANIA: 'Oceania' };

/** Short "who can apply" label for a job card. */
export function eligibilityLabel(job) {
  if (job.category === 'govt') {
    const d = job.domiciles || [];
    if (d.includes('ALL')) return 'All Pakistan';
    if (d.length) return `${d.map((x) => PROVINCE_NAME[x] || x).join(' / ')} domicile`;
    return null;
  }
  const e = job.eligible || [];
  if (e.includes('WORLD')) return job.country === 'PK' ? null : 'Open worldwide';
  if (e.includes('VISA')) return 'Visa sponsorship';
  const regions = e.filter((t) => REGION_LABEL[t]).map((t) => REGION_LABEL[t]);
  if (regions.length) return `Open to ${regions.slice(0, 2).join(', ')}`;
  return null;
}
