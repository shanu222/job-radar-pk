// Who can actually apply for a job.
//
// 1) Location eligibility — every job gets a list of tokens saying who may apply:
//      WORLD            open to applicants anywhere
//      PK, IN, US, …    applicants in / from that country (ISO-2)
//      ASIA, SOUTH_ASIA, APAC, MENA, EMEA, EUROPE, AMERICAS, AFRICA, OCEANIA   regions
//      VISA             on-site abroad, employer offers visa sponsorship / relocation
//      UNKNOWN          restriction we can't interpret → hidden in "jobs I can apply for"
//    A user can apply when any of their tokens (country + its regions + WORLD + VISA) is in the list.
//    Time-zone ranges ("UTC-3 to UTC+6") are turned into the countries whose time zone falls inside.
//
// 2) Domicile (Pakistani government jobs) — a list of provinces whose domicile holders may apply:
//      [] unknown/not stated, ['ALL'] all Pakistan / open merit, or e.g. ['punjab'].

export const PROVINCES = {
  punjab: 'Punjab', sindh: 'Sindh', kp: 'Khyber Pakhtunkhwa', balochistan: 'Balochistan',
  ict: 'Islamabad (ICT)', gb: 'Gilgit-Baltistan', ajk: 'Azad Jammu & Kashmir', merged: 'Merged Districts (ex-FATA)',
};

// Countries users can pick, with regions and UTC offset (for time-zone-restricted remote jobs)
export const COUNTRIES = {
  PK: ['Pakistan', ['ASIA', 'SOUTH_ASIA', 'APAC'], 5],
  IN: ['India', ['ASIA', 'SOUTH_ASIA', 'APAC'], 5.5],
  BD: ['Bangladesh', ['ASIA', 'SOUTH_ASIA', 'APAC'], 6],
  LK: ['Sri Lanka', ['ASIA', 'SOUTH_ASIA', 'APAC'], 5.5],
  NP: ['Nepal', ['ASIA', 'SOUTH_ASIA', 'APAC'], 5.75],
  AF: ['Afghanistan', ['ASIA', 'SOUTH_ASIA'], 4.5],
  AE: ['United Arab Emirates', ['MENA', 'EMEA'], 4],
  SA: ['Saudi Arabia', ['MENA', 'EMEA'], 3],
  QA: ['Qatar', ['MENA', 'EMEA'], 3],
  KW: ['Kuwait', ['MENA', 'EMEA'], 3],
  OM: ['Oman', ['MENA', 'EMEA'], 4],
  BH: ['Bahrain', ['MENA', 'EMEA'], 3],
  TR: ['Turkey', ['EUROPE', 'MENA', 'EMEA'], 3],
  EG: ['Egypt', ['MENA', 'AFRICA', 'EMEA'], 2],
  GB: ['United Kingdom', ['EUROPE', 'EMEA'], 0],
  IE: ['Ireland', ['EUROPE', 'EMEA'], 0],
  DE: ['Germany', ['EUROPE', 'EMEA'], 1],
  FR: ['France', ['EUROPE', 'EMEA'], 1],
  NL: ['Netherlands', ['EUROPE', 'EMEA'], 1],
  IT: ['Italy', ['EUROPE', 'EMEA'], 1],
  ES: ['Spain', ['EUROPE', 'EMEA'], 1],
  SE: ['Sweden', ['EUROPE', 'EMEA'], 1],
  US: ['United States', ['AMERICAS'], -5],
  CA: ['Canada', ['AMERICAS'], -5],
  AU: ['Australia', ['APAC', 'OCEANIA'], 10],
  NZ: ['New Zealand', ['APAC', 'OCEANIA'], 12],
  MY: ['Malaysia', ['ASIA', 'APAC'], 8],
  SG: ['Singapore', ['ASIA', 'APAC'], 8],
  CN: ['China', ['ASIA', 'APAC'], 8],
  JP: ['Japan', ['ASIA', 'APAC'], 9],
  PH: ['Philippines', ['ASIA', 'APAC'], 8],
  ID: ['Indonesia', ['ASIA', 'APAC'], 7],
  NG: ['Nigeria', ['AFRICA', 'EMEA'], 1],
  KE: ['Kenya', ['AFRICA', 'EMEA'], 3],
  ZA: ['South Africa', ['AFRICA', 'EMEA'], 2],
};

/** Tokens that let a user in `country` apply. */
export function userTokens(country = 'PK') {
  const c = COUNTRIES[country] ? country : 'PK';
  return ['WORLD', 'VISA', c, ...COUNTRIES[c][1]];
}

// Names that appear in job location text → token
const PLACE_PATTERNS = [
  [/\bpakistan\b|\bkarachi\b|\blahore\b|\bislamabad\b|\brawalpindi\b|\bpeshawar\b|\bquetta\b|\bfaisalabad\b|\bmultan\b/, 'PK'],
  [/\bindia\b|\bbangalore\b|\bbengaluru\b|\bmumbai\b|\bdelhi\b|\bhyderabad, india\b/, 'IN'],
  [/\bbangladesh\b/, 'BD'], [/\bsri lanka\b/, 'LK'], [/\bnepal\b/, 'NP'],
  [/\bunited arab emirates\b|\buae\b|\bdubai\b|\babu dhabi\b/, 'AE'], [/\bsaudi\b|\briyadh\b|\bjeddah\b/, 'SA'], [/\bqatar\b|\bdoha\b/, 'QA'],
  [/\bunited states\b|\busa\b|\bu\.s\.a?\b|\bus only\b|\bus-based\b|\bus based\b|\(us\)|\bus citizens?\b|\bnorth america\b/, 'US'],
  [/\bcanada\b/, 'CA'], [/\bunited kingdom\b|\buk\b|\bengland\b|\blondon\b/, 'GB'], [/\bireland\b/, 'IE'],
  [/\bgermany\b|\bberlin\b|\bmunich\b|\bhamburg\b|\bdeutschland\b/, 'DE'], [/\bfrance\b|\bparis\b/, 'FR'], [/\bnetherlands\b|\bamsterdam\b/, 'NL'],
  [/\bspain\b/, 'ES'], [/\bitaly\b/, 'IT'], [/\bsweden\b/, 'SE'], [/\baustralia\b/, 'AU'], [/\bnew zealand\b/, 'NZ'],
  [/\bsingapore\b/, 'SG'], [/\bmalaysia\b/, 'MY'], [/\bphilippines\b/, 'PH'], [/\bindonesia\b/, 'ID'], [/\bturkey\b|\btürkiye\b/, 'TR'],
  [/\begypt\b/, 'EG'], [/\bnigeria\b/, 'NG'], [/\bkenya\b/, 'KE'], [/\bsouth africa\b/, 'ZA'], [/\bjapan\b/, 'JP'], [/\bchina\b/, 'CN'],
  [/\bsouth asia\b/, 'SOUTH_ASIA'], [/\bapac\b|\basia[- ]pacific\b/, 'APAC'], [/\basia\b/, 'ASIA'],
  [/\bmena\b|\bmiddle east\b|\bgcc\b/, 'MENA'], [/\bemea\b/, 'EMEA'],
  [/\beurope\b|\beuropean\b|\beu\b|\bschengen\b|\beea\b/, 'EUROPE'],
  [/\bamericas\b|\blatam\b|\blatin america\b|\bsouth america\b/, 'AMERICAS'], [/\bafrica\b/, 'AFRICA'], [/\boceania\b/, 'OCEANIA'],
];
const WORLDWIDE = /\b(anywhere|worldwide|world ?wide|global(ly)?|any (country|location)|all countries|international|home-based|work from anywhere|fully remote)\b/;
const GENERIC = /^\s*(remote|remote job|fully remote|100% remote|home[- ]based|wfh|work from home|online|see post|-|n\/a|)\s*$/;
const VISA_YES = /\b(visa sponsorship (is )?(available|provided|offered)|we (can |will |do )?sponsor (your |a )?visa|sponsor(s|ing)? (work )?visas?|relocation (package|support|assistance) (is )?(available|provided|offered)|visa and relocation)\b/;
const VISA_NO = /\b(no|not|unable to|cannot|can't|don't|do not|won't|will not)\b[^.]{0,30}\bsponsor|\bsponsorship (is )?not (available|provided|offered)|without (the )?need (for|of) (visa )?sponsorship|must (already )?(have|hold) (the )?(right|authori[sz]ation) to work\b/;

/** Countries whose UTC offset falls inside every "UTC-x to UTC+y" range found in the text. */
function timeZoneCountries(text) {
  const ranges = [...text.matchAll(/(?:utc|gmt)\s*([+-−]\s*\d{1,2}(?:[:.]\d{2})?)\s*(?:to|-|–|and|through)\s*(?:utc|gmt)?\s*([+-−]\s*\d{1,2}(?:[:.]\d{2})?)/g)];
  if (!ranges.length) return [];
  const n = (s) => { const t = s.replace(/\s|−/g, (c) => (c === '−' ? '-' : '')); const [h, m] = t.split(/[:.]/); return Number(h) + (m ? Math.sign(Number(h) || 1) * Number(m) / 60 : 0); };
  const out = new Set();
  for (const [, a, b] of ranges) {
    const lo = Math.min(n(a), n(b)), hi = Math.max(n(a), n(b));
    for (const [code, [, , off]] of Object.entries(COUNTRIES)) if (off >= lo && off <= hi) out.add(code);
  }
  return [...out];
}

// Phrases in the ad body that state where applicants must be
const HINT_RES = [
  /\b(?:job )?location\s*[:\-–]\s*([^\n]{2,80})/gi,
  /\bterritor(?:y|ies)\s*[:\-–]\s*([^\n]{2,80})/gi,
  /\bremote\s*[(\[]\s*([^)\]\n]{2,40})[)\]]/gi,
  /\bremote\s*[-–,]\s*([a-z .&/]{2,40})/gi,
  /\bremote (?:in|from|within|across) (?:the )?([a-z ,.&/]{2,50})/gi,
  /\b(?:must|should|need to|required to)? ?(?:be )?(?:based|located|living|residing|resident) (?:in|within) (?:the )?([a-z ,.&/]{2,60})/gi,
  /\b(?:eligible|authori[sz]ed|right) to work in (?:the )?([a-z ,.&/]{2,50})/gi,
  /\b(us|u\.s\.|uk|eu|european|canadian|australian)[- ]based\b/gi,
];
function locationHints(desc) {
  const out = [];
  for (const re of HINT_RES) { re.lastIndex = 0; let m; while ((m = re.exec(desc)) && out.length < 12) out.push(m[1].toLowerCase()); }
  return out.join(' | ');
}

/**
 * Location eligibility tokens for a normalized job.
 * job: { country: 'PK'|'INTL', is_remote, location, description, restriction_codes? }
 */
export function locationEligibility(job) {
  if (job.country === 'PK') return ['PK'];
  const loc = String(job.location || '').toLowerCase();
  const desc = String(job.description || '').slice(0, 6000).toLowerCase();
  const tokens = new Set((job.restriction_codes || []).filter(Boolean).map(String));

  if (!job.is_remote) {
    // On-site outside Pakistan: realistic for Pakistanis only with sponsorship, or if the job is in Pakistan
    for (const [re, t] of PLACE_PATTERNS) if (re.test(loc) && t.length === 2) tokens.add(t);
    if (tokens.has('PK')) return ['PK'];
    if (VISA_YES.test(desc) && !VISA_NO.test(desc)) tokens.add('VISA');
    return tokens.size ? [...tokens] : ['UNKNOWN'];
  }

  // Remote: read restrictions from the location field, then from what the ad body says
  for (const [re, t] of PLACE_PATTERNS) if (re.test(loc)) tokens.add(t);
  for (const c of timeZoneCountries(`${loc} ${desc}`)) tokens.add(c);
  if (!tokens.size && (GENERIC.test(loc) || WORLDWIDE.test(loc))) {
    const hints = locationHints(desc);
    const openAnywhere = /\b(hire|hiring|work|working|remote|candidates|applicants|team members?|people|talent)\b[^.\n]{0,40}\b(anywhere|worldwide|world-wide|any country|all countries|around the (world|globe))\b/.test(desc);
    if (openAnywhere && !hints) tokens.add('WORLD');
    if (hints) {
      if (WORLDWIDE.test(hints)) tokens.add('WORLD');
      for (const [re, t] of PLACE_PATTERNS) if (re.test(hints)) tokens.add(t);
      if (tokens.has('WORLD') && tokens.size > 1 && !/\bworldwide\b|\banywhere\b/.test(hints)) tokens.delete('WORLD');
    }
  }
  if (!tokens.size) {
    if (WORLDWIDE.test(loc)) tokens.add('WORLD');
    else if (GENERIC.test(loc)) {
      // Nothing stated: boards that mostly list jobs for one region default to that region
      if (job.region_hint?.length) for (const t of job.region_hint) tokens.add(t);
      else tokens.add('WORLD');
    } else tokens.add('UNKNOWN');
  } else if (WORLDWIDE.test(loc) && !/\bonly\b/.test(loc)) {
    tokens.add('WORLD'); // e.g. "Worldwide (preference for EU)"
  }
  return [...tokens];
}

// ── Languages ───────────────────────────────────────────────────────────────
// Non-English languages a job requires ("German speaking", "fluent in French", "Arabic is a must").
const LANGS = ['german', 'french', 'spanish', 'italian', 'dutch', 'portuguese', 'polish', 'swedish', 'danish', 'norwegian', 'finnish',
  'czech', 'romanian', 'hungarian', 'greek', 'turkish', 'russian', 'ukrainian', 'hebrew', 'arabic', 'japanese', 'chinese', 'mandarin',
  'cantonese', 'korean', 'thai', 'vietnamese', 'indonesian', 'malay', 'hindi', 'bengali', 'persian', 'farsi', 'pashto', 'sindhi', 'punjabi', 'urdu'];
const L = LANGS.join('|');
const LANG_REQ = [
  new RegExp(`\\b(${L})[- ]speaking\\b`, 'g'),
  new RegExp(`\\b(?:fluent|fluency|native|proficient|proficiency|business[- ]level|excellent|strong|professional)\\s+(?:in\\s+|level\\s+)?(?:written and spoken |spoken and written |command of )?(${L})\\b`, 'g'),
  new RegExp(`\\b(${L})\\s*(?:\\((?:c1|c2|b2|native)\\)|(?:language )?(?:is |are )?(?:required|mandatory|essential|a must|necessary))`, 'g'),
  new RegExp(`\\b(${L})\\s+(?:and|&)\\s+english\\b(?=[^.]{0,40}(?:required|fluent|essential|must))`, 'g'),
  /\b(deutsch)(?:kenntnisse|e? sprachkenntnisse)\b/g,
];
const LANG_NORM = { mandarin: 'chinese', cantonese: 'chinese', farsi: 'persian', deutsch: 'german' };

export function requiredLanguages(title, description) {
  const t = `${title || ''}\n${String(description || '').slice(0, 6000)}`.toLowerCase();
  const out = new Set();
  for (const re of LANG_REQ) { re.lastIndex = 0; let m; while ((m = re.exec(t))) out.add(LANG_NORM[m[1]] || m[1]); }
  out.delete('english');
  return [...out];
}

/** Languages a person speaks, from their CV text and skills (English and Urdu assumed for Pakistan). */
export function userLanguages(user) {
  const out = new Set(['english']);
  if ((user.country || 'PK') === 'PK') out.add('urdu');
  const t = `${user.cv_text || ''} ${(user.skills || []).join(' ')}`.toLowerCase();
  for (const l of LANGS) if (new RegExp(`\\b${l}\\b`).test(t)) out.add(LANG_NORM[l] || l);
  return [...out];
}

// ── Domicile (Pakistani government jobs) ─────────────────────────────────────
const PROVINCE_PATTERNS = {
  punjab: /\bpunjab\b/,
  sindh: /\bsindh\b/,
  kp: /\b(khyber[- ]?pakhtunkhwa|k\.?p\.?k?|kpk|nwfp)\b/,
  balochistan: /\b(balochistan|baluchistan)\b/,
  ict: /\b(islamabad capital territory|i\.?c\.?t\.?|federal capital|islamabad)\b/,
  gb: /\b(gilgit[- ]?baltistan|g\.?b\.?)\b/,
  ajk: /\b(azad (jammu (and|&) )?kashmir|a\.?j\.?k\.?)\b/,
  merged: /\b(ex[- ]?fata|fata|merged (areas|districts))\b/,
};
const DOMICILE_CUE = /(domicile|domiciled|belong(s|ing)? to|bona ?fide resident|permanent resident|resident of|provincial quota|regional quota|quota)/g;
const ALL_PAKISTAN = /\b(all[- ]pakistan( basis)?|open merit|merit quota|from all over pakistan|all provinces|all pakistani nationals|any domicile)\b/;

/** Provinces whose domicile holders may apply, from the ad text (+ the commission's default). */
export function extractDomiciles(text, siteDefault) {
  const t = String(text || '').toLowerCase();
  const found = new Set();
  let m;
  DOMICILE_CUE.lastIndex = 0;
  while ((m = DOMICILE_CUE.exec(t))) {
    const win = t.slice(Math.max(0, m.index - 60), m.index + 180);
    for (const [k, re] of Object.entries(PROVINCE_PATTERNS)) if (re.test(win)) found.add(k);
  }
  if (ALL_PAKISTAN.test(t)) return ['ALL'];
  if (found.size) return [...found];
  return siteDefault ? [siteDefault] : [];
}

export function canApplyDomicile(domiciles, userDomicile) {
  if (!domiciles?.length || domiciles.includes('ALL')) return true;
  return !!userDomicile && domiciles.includes(userDomicile);
}

/** SQL fragment + params for "jobs this user can apply for". Push params onto `params`. */
export function eligibilitySql(params, { country, domicile, languages }) {
  params.push(userTokens(country));
  const tok = `$${params.length}`;
  params.push(languages?.length ? languages : ['english', ...((country || 'PK') === 'PK' ? ['urdu'] : [])]);
  let sql = `(eligible && ${tok}::text[]) AND (languages = '{}' OR languages <@ $${params.length}::text[])`;
  if ((country || 'PK') === 'PK') {
    if (domicile) {
      params.push(domicile);
      const d = `$${params.length}`;
      sql += ` AND (category <> 'govt' OR domiciles = '{}' OR 'ALL' = ANY(domiciles) OR ${d}::text = ANY(domiciles))`;
    }
  } else {
    sql += ` AND category <> 'govt'`; // Pakistani government jobs need Pakistani nationality
  }
  return sql;
}
