// Extracts an application deadline from free text (Pakistani ads use many formats:
// "Last date to apply: 25-11-2026", "Last Date: November 25, 2026", "Closing date 25th Nov 2026",
// "apply before 25/11/2026", "Deadline: 2026-11-25").

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const CUE = /(last\s*date(?:\s*(?:to|for)\s*(?:apply|submission|receipt)[a-z\s]*)?|closing\s*date|deadline|apply\s*(?:by|before|until|till)|applications?\s*(?:close|due)[a-z\s]*|due\s*date|submission\s*date)\s*(?:is|of|:|-|–)?\s*/i;

const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

function mk(y, m, d) {
  if (y < 100) y += 2000;
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCMonth() !== m) return null;
  return dt;
}

/** Parse the first date found at the start of `s`. Pakistani convention: DD-MM-YYYY. */
export function parseDateLoose(s, ref = new Date()) {
  if (!s) return null;
  s = s.trim();
  let m;
  // 2026-11-25
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return mk(+m[1], +m[2] - 1, +m[3]);
  // 25-11-2026 / 25/11/26 / 25.11.2026  (day first)
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // US-style fallback
    return mk(+m[3], mo - 1, d);
  }
  // 25th November, 2026 / 25 Nov 2026
  if ((m = s.match(new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s*)?${MONTH_RE}[a-z]*[,\\s]*(\\d{4})?`, 'i')))) {
    const y = m[3] ? +m[3] : inferYear(MONTHS[m[2].toLowerCase()], +m[1], ref);
    return mk(y, MONTHS[m[2].toLowerCase()], +m[1]);
  }
  // November 25, 2026 / Nov 25th 2026
  if ((m = s.match(new RegExp(`^${MONTH_RE}[a-z]*\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?[,\\s]*(\\d{4})?`, 'i')))) {
    const y = m[3] ? +m[3] : inferYear(MONTHS[m[1].toLowerCase()], +m[2], ref);
    return mk(y, MONTHS[m[1].toLowerCase()], +m[2]);
  }
  return null;
}

function inferYear(month, day, ref) {
  const y = ref.getUTCFullYear();
  const candidate = Date.UTC(y, month, day);
  // If the date already passed by > 60 days, it probably refers to next year.
  return candidate < ref.getTime() - 60 * 86400000 ? y + 1 : y;
}

/** Find a deadline in free text. Returns a Date (UTC midnight) or null. */
export function extractDeadline(text, ref = new Date()) {
  if (!text) return null;
  const flat = String(text).replace(/\s+/g, ' ');
  const re = new RegExp(CUE.source, 'ig');
  let match;
  while ((match = re.exec(flat))) {
    const after = flat.slice(match.index + match[0].length, match.index + match[0].length + 40);
    const d = parseDateLoose(after, ref);
    if (d) return d;
  }
  return null;
}

export const toISODate = (d) => (d ? d.toISOString().slice(0, 10) : null);

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((d.getTime() - today) / 86400000);
}
