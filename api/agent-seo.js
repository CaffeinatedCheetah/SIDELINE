import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { callClaude, parseJSON } from './_claude-api.js';
import { patchMemory, readMemory } from './_scout-memory.js';

const SEO_INTERVAL = 6 * 60 * 60 * 1000;

const TOPICS = [
  { sport: 'NFL',    kws: ['nfl trade rumors', 'nfl injury report', 'nfl power rankings', 'super bowl predictions', 'fantasy football picks', 'nfl draft analysis'] },
  { sport: 'NBA',    kws: ['nba trade rumors', 'nba mvp race', 'nba playoff predictions', 'best nba players 2025', 'nba standings analysis', 'basketball power rankings'] },
  { sport: 'Soccer', kws: ['world cup 2026 predictions', 'premier league standings', 'champions league analysis', 'best soccer players 2025', 'la liga results', 'soccer transfer news'] },
  { sport: 'MLB',    kws: ['mlb trade deadline rumors', 'world series predictions', 'best pitchers 2025', 'mlb power rankings', 'baseball standings analysis'] },
  { sport: 'NHL',    kws: ['stanley cup predictions', 'nhl trade rumors', 'best nhl players 2025', 'hockey power rankings', 'nhl playoff race'] },
  { sport: 'UFC',    kws: ['ufc fight card analysis', 'mma pound for pound rankings', 'best fighters 2025', 'boxing vs mma debate', 'ufc predictions tonight'] },
  { sport: 'F1',     kws: ['f1 standings 2025', 'best f1 drivers ever', 'formula 1 predictions', 'f1 constructor championship', 'monaco grand prix analysis'] },
  { sport: 'Rugby',  kws: ['six nations 2025 predictions', 'best rugby players world', 'rugby union vs league', 'premiership rugby standings', 'world rugby rankings'] },
];

const SYSTEM = `You are a sports journalist writing SEO-optimized articles for Sideline (fantakes.app).
Articles target specific Google search queries. Write with energy, facts, and fan perspective.
Every article must end with a question inviting fans to debate: "What's your take? Drop it on Sideline →"`;

async function generate(topic, keyword) {
  const text = await callClaude({
    prompt: `Write a short SEO article for Sideline about: "${keyword}"

Requirements:
- headline: 50-65 chars, includes keyword, punchy
- subheadline: 110-140 chars, adds context
- body: 3 paragraphs (~150 words each). Current state → historical context → fan debate angle.
  End final paragraph with: "What's your take? Drop it on Sideline →"
- metaDescription: 150-160 chars for Google
- keywords: 5-7 related search terms
- sport: ${topic.sport}
- tag: one of [Hot Take, Trending, Must See, Exclusive, Analysis]

Return ONLY valid JSON:
{"headline":"...","subheadline":"...","body":"...","metaDescription":"...","keywords":["..."],"sport":"${topic.sport}","tag":"...","targetKeyword":"${keyword}"}`,
    system: SYSTEM,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1400,
  });
  return parseJSON(text);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 5, 60000)) return res.status(429).json({ error: 'Rate limit' });

  const mem      = await readMemory();
  const lastRun  = mem.seoLastRun || 0;
  const stale    = Date.now() - new Date(lastRun || 0).getTime() > SEO_INTERVAL;

  if (!stale && !req.query.force) {
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ articles: 0, message: 'Not due yet', lastRun, nextRun: new Date(new Date(lastRun).getTime() + SEO_INTERVAL).toISOString() });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ articles: 0, message: 'ANTHROPIC_API_KEY not set' });
  }

  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${req.headers.host}`;

  // Pick 3 random topic+keyword combos this run
  const shuffled = [...TOPICS].sort(() => Math.random() - 0.5).slice(0, 3);
  const results  = { articles: 0, generated: [], errors: [] };

  for (const topic of shuffled) {
    const keyword = topic.kws[Math.floor(Math.random() * topic.kws.length)];
    try {
      const article = await generate(topic, keyword);
      if (!article?.headline) { results.errors.push({ keyword, error: 'No headline' }); continue; }

      const full = {
        id:             `seo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type:           'seo',
        seoOptimized:   true,
        aiGenerated:    true,
        publishedAt:    new Date().toISOString(),
        sourceUrl:      `https://fantakes.app/#${topic.sport.toLowerCase()}`,
        sourceUsername: 'sideline_scout',
        ...article,
      };

      await fetch(`${baseUrl}/api/articles-store`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(full),
      });

      results.articles++;
      results.generated.push({ headline: full.headline, keyword, sport: topic.sport });
    } catch (err) {
      results.errors.push({ keyword, error: err.message });
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  await patchMemory({ seoLastRun: new Date().toISOString(), seoLastCount: results.articles });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(results);
}
