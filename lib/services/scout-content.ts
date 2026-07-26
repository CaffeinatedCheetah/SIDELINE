const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// TS port of api/_claude-api.js's callClaude/parseJSON for the App Router
// route -- kept separate rather than importing the .js file across the
// pages-api/App Router boundary.
export async function callClaude({
  prompt,
  system = "",
  model = "claude-haiku-4-5-20251001",
  maxTokens = 1024,
}: {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(no body)");
    throw new Error(`Anthropic API ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content?: { text?: string }[];
  };
  return data.content?.[0]?.text ?? "";
}

export function parseJSON<T = unknown>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1]!.trim() : text.trim();
  const arrStart = raw.indexOf("[");
  const objStart = raw.indexOf("{");
  let jsonStr = raw;
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    jsonStr = raw.slice(arrStart, raw.lastIndexOf("]") + 1);
  } else if (objStart !== -1) {
    jsonStr = raw.slice(objStart, raw.lastIndexOf("}") + 1);
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}
