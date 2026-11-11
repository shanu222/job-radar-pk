// AI with automatic fallback across providers and models.
//
// Order: the key saved in Admin → Settings → AI (if any) first, then the env providers in
// AI_PROVIDER_ORDER (default "gemini,openrouter,openai,anthropic"). Each provider can have several
// models (e.g. OPENROUTER_MODELS="a:free,b:free"). When a model hits a rate limit / quota, has a bad
// key, or errors, it is rested ("cooled down") for a while and the next one is tried — so requests
// keep working as long as any key still has quota.
import { getSettings } from './settings.js';
import { query } from '../db.js';

const env = process.env;
const TIMEOUT = () => Number(env.AI_TIMEOUT_MS || 45000);
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const DEFAULT_MODELS = {
  gemini: () => [env.GEMINI_MODEL || 'gemini-2.5-flash', env.GEMINI_FALLBACK_MODEL].filter(Boolean),
  openrouter: () => (list(env.OPENROUTER_MODELS).length ? list(env.OPENROUTER_MODELS) : ['meta-llama/llama-3.3-70b-instruct:free']),
  openai: () => [env.OPENAI_MODEL || 'gpt-4.1-mini', env.OPENAI_FALLBACK_MODEL].filter(Boolean),
  anthropic: () => [env.ANTHROPIC_MODEL || 'claude-haiku-5-5'],
};
const ENV_KEYS = { gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };
const LABEL = { gemini: 'Google Gemini', openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic Claude' };

/** model id → time (ms) until which it is skipped */
const cooldown = new Map();
const lastError = new Map();

async function attempts() {
  const s = await getSettings();
  if (s.ai.enabled === false) return [];
  const out = [];
  const seen = new Set();
  const push = (kind, key, model, baseUrl, source) => {
    const id = `${kind}:${model}${source === 'admin' ? ' (admin key)' : ''}`;
    if (!key || !model || seen.has(id)) return;
    seen.add(id);
    out.push({ id, kind, key, model, baseUrl, source });
  };
  // 1) Key saved in the admin panel
  if (s.ai.apiKey) {
    const kind = s.ai.provider;
    const models = s.ai.model ? [s.ai.model] : (DEFAULT_MODELS[kind] || DEFAULT_MODELS.openai)();
    for (const m of models) push(kind, s.ai.apiKey, m, s.ai.baseUrl, 'admin');
  }
  // 2) Keys from environment variables, in AI_PROVIDER_ORDER
  for (const kind of list(env.AI_PROVIDER_ORDER || 'gemini,openrouter,openai,anthropic')) {
    if (!ENV_KEYS[kind]) continue;
    for (const m of DEFAULT_MODELS[kind]()) push(kind, env[ENV_KEYS[kind]], m, '', 'env');
  }
  return out;
}

// ── Provider calls ───────────────────────────────────────────────────────────
class AiHttpError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

async function post(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT()) });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new AiHttpError(res.status, msg, Number(res.headers.get('retry-after')) || 0);
  }
  return data;
}

async function call(a, { system, prompt, maxTokens }) {
  if (a.kind === 'anthropic') {
    const d = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': a.key, 'anthropic-version': '2023-06-01' },
      { model: a.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] });
    return d.content?.filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  if (a.kind === 'gemini') {
    const d = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.model)}:generateContent`, { 'x-goog-api-key': a.key }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: Math.max(maxTokens, 1024), temperature: 0.4, thinkingConfig: /2\.5/.test(a.model) ? { thinkingBudget: 0 } : undefined },
    });
    const cand = d.candidates?.[0];
    if (!cand?.content?.parts) throw new AiHttpError(502, `Gemini returned no text (${cand?.finishReason || d.promptFeedback?.blockReason || 'empty'})`);
    return cand.content.parts.map((p) => p.text || '').join('');
  }
  // OpenAI and OpenAI-compatible (OpenRouter, Groq, DeepSeek…)
  const base = a.kind === 'openrouter' ? 'https://openrouter.ai/api/v1' : (a.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const headers = { authorization: `Bearer ${a.key}` };
  if (a.kind === 'openrouter') Object.assign(headers, { 'HTTP-Referer': env.FRONTEND_URL?.split(',')[0] || 'https://jobradar.pk', 'X-Title': 'JobRadar PK' });
  const d = await post(`${base}/chat/completions`, headers, {
    model: a.model, max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
  });
  const text = d.choices?.[0]?.message?.content;
  if (!text) throw new AiHttpError(502, `${a.kind} returned no text`);
  return text;
}

/** How long to rest a model after this error. */
function restFor(e) {
  const msg = String(e.message || '').toLowerCase();
  if (e.retryAfter) return Math.min(e.retryAfter * 1000, 6 * 3600_000);
  if (e.status === 429 || /quota|rate.?limit|resource.?exhausted|exceeded|insufficient/.test(msg)) return /day|daily|per.?day/.test(msg) ? 6 * 3600_000 : 15 * 60_000;
  if (e.status === 401 || e.status === 403 || /api key|unauthori[sz]ed|permission/.test(msg)) return 6 * 3600_000; // bad/revoked key
  if (e.status === 404 || e.status === 400 && /model/.test(msg)) return 24 * 3600_000;                       // model not available
  if (e.status === 402) return 6 * 3600_000;                                                                  // out of credit
  return 2 * 60_000;                                                                                          // timeout / 5xx / network
}

export async function aiAvailable() {
  return (await attempts()).length > 0;
}

/** Text completion with fallback. Throws a user-safe error only if every provider fails. */
export async function complete({ system, prompt, maxTokens = 900 }) {
  const all = await attempts();
  if (!all.length) throw Object.assign(new Error('AI features are not switched on yet'), { status: 503 });
  const now = Date.now();
  // Models that are resting go to the back instead of being dropped, in case every one is resting
  const ordered = [...all.filter((a) => (cooldown.get(a.id) || 0) <= now), ...all.filter((a) => (cooldown.get(a.id) || 0) > now)];
  const errors = [];
  for (const a of ordered.slice(0, Number(env.AI_MAX_ATTEMPTS || 8))) {
    try {
      const text = String(await call(a, { system, prompt, maxTokens }) || '').trim();
      if (!text) throw new AiHttpError(502, 'empty reply');
      cooldown.delete(a.id);
      if (env.AI_LOGGING !== 'false') console.log(`[ai] answered by ${a.id}`);
      return text;
    } catch (e) {
      const ms = restFor(e);
      cooldown.set(a.id, Date.now() + ms);
      lastError.set(a.id, { message: String(e.message).slice(0, 200), at: new Date().toISOString() });
      errors.push(`${a.id}: ${e.message}`);
      console.warn(`[ai] ${a.id} failed (${e.status || e.name}): ${String(e.message).slice(0, 160)} — resting ${Math.round(ms / 60000)} min`);
    }
  }
  throw Object.assign(new Error('The AI service is busy right now. Please try again in a few minutes.'), { status: 502, detail: errors.join(' | ') });
}

/** Admin panel: which providers/models are configured and which are resting. */
export async function aiStatus() {
  const now = Date.now();
  return (await attempts()).map((a) => ({
    id: a.id, provider: LABEL[a.kind] || a.kind, model: a.model, source: a.source,
    resting_until: (cooldown.get(a.id) || 0) > now ? new Date(cooldown.get(a.id)).toISOString() : null,
    last_error: lastError.get(a.id) || null,
  }));
}

export function resetCooldowns() { cooldown.clear(); }

/** Parse the first JSON object in a model reply. */
export function parseJSON(text) {
  const m = String(text).replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI returned no JSON');
  return JSON.parse(m[0]);
}

/** Per-user daily limit for AI calls. Returns false when the limit is used up. */
export async function takeAiCall(userId) {
  const s = await getSettings();
  const { rowCount } = await query(
    `INSERT INTO ai_usage (user_id, day, calls) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_usage.calls + 1 WHERE ai_usage.calls < $2`,
    [userId, s.ai_daily_limit || 20]
  );
  return rowCount > 0;
}

/** Admin test: runs the normal fallback chain and reports which model answered. */
export async function testAI() {
  resetCooldowns();
  const all = await attempts();
  if (!all.length) throw Object.assign(new Error('No AI key configured'), { status: 503 });
  const results = [];
  for (const a of all) {
    const t0 = Date.now();
    try {
      const reply = String(await call(a, { system: 'Reply with one short sentence.', prompt: 'Say hello to the JobRadar PK admin.', maxTokens: 60 })).trim();
      results.push({ id: a.id, ok: true, ms: Date.now() - t0, reply: reply.slice(0, 120) });
    } catch (e) {
      cooldown.set(a.id, Date.now() + restFor(e));
      results.push({ id: a.id, ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 160) });
    }
  }
  return { ok: results.some((r) => r.ok), results };
}
