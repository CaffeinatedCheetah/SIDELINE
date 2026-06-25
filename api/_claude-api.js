// Thin wrapper for Anthropic API calls used by SCOUT agents.
// Uses claude-haiku for speed-critical ops, claude-sonnet for quality tasks.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VER = '2023-06-01';

export async function callClaude({ prompt, system = '', model = 'claude-haiku-4-5-20251001', maxTokens = 1024 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error('[SCOUT claude-api] ANTHROPIC_API_KEY is not set');
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  console.log('[SCOUT claude-api] calling model:', model, '| maxTokens:', maxTokens, '| promptLen:', prompt.length);

  const r = await fetch(ANTHROPIC_API, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         key,
      'anthropic-version': ANTHROPIC_VER,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system:     system || undefined,
      messages:   [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(15000), // 15s hard cap per Claude call
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => '(no body)');
    console.error('[SCOUT claude-api] API error', r.status, errText.slice(0, 300));
    throw new Error(`Anthropic API ${r.status}: ${errText.slice(0, 200)}`);
  }

  const d    = await r.json();
  const text = d.content?.[0]?.text || '';
  console.log('[SCOUT claude-api] response length:', text.length, '| first 100 chars:', text.slice(0, 100));
  return text;
}

// Parses a JSON block from Claude's response — handles ```json fences or bare JSON
export function parseJSON(text) {
  // Try to extract from code fences first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw    = fenced ? fenced[1].trim() : text.trim();

  // Find the first [ or { and the last ] or } to handle leading/trailing text
  const arrStart = raw.indexOf('[');
  const objStart = raw.indexOf('{');
  let jsonStr = raw;

  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    jsonStr = raw.slice(arrStart, raw.lastIndexOf(']') + 1);
  } else if (objStart !== -1) {
    jsonStr = raw.slice(objStart, raw.lastIndexOf('}') + 1);
  }

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[SCOUT claude-api] JSON parse failed. Raw:', raw.slice(0, 200));
    return null;
  }
}
