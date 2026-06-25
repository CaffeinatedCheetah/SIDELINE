// Thin wrapper for Anthropic API calls used by SCOUT agents.
// Uses claude-haiku for speed-critical ops, claude-sonnet for quality tasks.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VER = '2023-06-01';

export async function callClaude({ prompt, system = '', model = 'claude-haiku-4-5-20251001', maxTokens = 1024 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const r = await fetch(ANTHROPIC_API, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       key,
      'anthropic-version': ANTHROPIC_VER,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Anthropic API ${r.status}: ${err.slice(0, 200)}`);
  }

  const d = await r.json();
  return d.content?.[0]?.text || '';
}

// Parses a JSON block out of Claude's response (handles ```json fences or bare JSON)
export function parseJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}
