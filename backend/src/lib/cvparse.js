import mammoth from 'mammoth';
import { findSkills, findExperienceYears } from './skills.js';
import { config } from '../config.js';

export async function extractText(buffer, mimetype, filename = '') {
  const name = filename.toLowerCase();
  if (mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    // import lazily: pdf-parse's index runs a self-test when imported directly
    const { default: pdf } = await import('pdf-parse/lib/pdf-parse.js');
    const out = await pdf(buffer);
    return out.text;
  }
  if (name.endsWith('.docx') || mimetype.includes('wordprocessingml')) {
    const out = await mammoth.extractRawText({ buffer });
    return out.value;
  }
  if (mimetype.startsWith('text/') || name.endsWith('.txt')) return buffer.toString('utf8');
  throw new Error('Unsupported file type. Upload a PDF, DOCX or TXT CV.');
}

const TITLE_HINTS = /(engineer|developer|manager|officer|analyst|designer|consultant|specialist|lecturer|teacher|accountant|scientist|architect|administrator|coordinator|executive|director|founder|intern|editor|writer|assistant)/i;

function guessTitles(text) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 3 && l.length < 70);
  const titles = [];
  for (const l of lines) {
    if (TITLE_HINTS.test(l) && !/@|http|\d{4}.*\d{4}/.test(l)) titles.push(l.replace(/[|•–-].*$/, '').trim());
    if (titles.length >= 6) break;
  }
  return [...new Set(titles)];
}

/** Heuristic profile extraction; upgraded by Claude if ANTHROPIC_API_KEY is set. */
export async function buildProfileFromCV(text) {
  const base = {
    skills: findSkills(text),
    titles: guessTitles(text),
    experience_years: findExperienceYears(text),
  };
  if (!config.anthropicKey) return base;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': config.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Extract from this CV a JSON object {"skills": string[] (max 30, short lowercase skill names), "titles": string[] (job titles held or targeted, max 6), "experience_years": number|null}. Reply with JSON only.\n\nCV:\n${text.slice(0, 12000)}`,
        }],
      }),
    });
    const data = await res.json();
    const json = JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]);
    return {
      skills: [...new Set([...base.skills, ...findSkills((json.skills || []).join(', ')), ...(json.skills || []).map((s) => s.toLowerCase())])],
      titles: json.titles?.length ? json.titles : base.titles,
      experience_years: json.experience_years ?? base.experience_years,
    };
  } catch (e) {
    console.warn('[cv] LLM extraction failed, using heuristics:', e.message);
    return base;
  }
}
