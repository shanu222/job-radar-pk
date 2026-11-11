// AI provider wrapper. The admin sets provider + API key + model in the admin panel (stored server-side,
// never sent to browsers). Supports Anthropic (Claude) and any OpenAI-compatible API
// (OpenAI, Groq, DeepSeek, OpenRouter… via Base URL).
import { getSettings } from './settings.js';
import { query } from '../db.js';

const DEFAULT_MODEL = { anthropic: 'claude-haiku-5-5', openai: 'gpt-4o-mini' };

async function aiConfig() {
  const s = await getSettings();
  const provider = s.ai.provider === 'openai' ? 'openai' : 'anthropic';
  const apiKey = s.ai.apiKey || (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) || '';
  return { provider, apiKey, model: s.ai.model || DEFAULT_MODEL[provider], baseUrl: s.ai.baseUrl, enabled: s.ai.enabled !== false, dailyLimit: s.ai_daily_limit };
}

export async function aiAvailable() {
  const c = await aiConfig();
  return c.enabled && !!c.apiKey;
}

/** Plain-text completion. Throws with a user-safe message on failure. */
export async function complete({ system, prompt, maxTokens = 900 }) {
  const c = await aiConfig();
  if (!c.enabled || !c.apiKey) throw Object.assign(new Error('AI features are not switched on yet'), { status: 503 });
  let res, data;
  try {
    if (c.provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(60000),
      });
      data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    }
    const base = (c.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${c.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: c.model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60000),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return String(data.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    console.error('[ai] request failed:', e.message);
    throw Object.assign(new Error('The AI service did not respond. Please try again in a minute.'), { status: 502, detail: e.message });
  }
}

/** Parse the first JSON object in a model reply. */
export function parseJSON(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI returned no JSON');
  return JSON.parse(m[0]);
}

/** Per-user daily limit for AI calls. Returns false when the limit is used up. */
export async function takeAiCall(userId) {
  const c = await aiConfig();
  const { rowCount } = await query(
    `INSERT INTO ai_usage (user_id, day, calls) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_usage.calls + 1 WHERE ai_usage.calls < $2`,
    [userId, c.dailyLimit || 20]
  );
  return rowCount > 0;
}

/** Quick connectivity check for the admin panel. */
export async function testAI() {
  const out = await complete({ system: 'Reply with one short sentence.', prompt: 'Say hello to the JobRadar PK admin.', maxTokens: 60 });
  const c = await aiConfig();
  return { ok: true, provider: c.provider, model: c.model, reply: out };
}
