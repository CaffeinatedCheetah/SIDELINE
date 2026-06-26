// api/agent-social.js
// SIDELINE - Social Monitor Agent
// Monitors athlete/celebrity X posts, generates embeds + AI-written articles
// Runs on a cron trigger (every 15 minutes recommended)

const Anthropic = require('@anthropic-ai/sdk');

// ============================================================
// ATHLETE WATCHLIST
// Add X usernames here — these accounts get monitored
// ============================================================
const ATHLETE_WATCHLIST = [
  // NBA
  'KingJames', 'StephenCurry30', 'KDTrey5', 'Giannis_An34',
  // NFL
  'PatrickMahomes', 'TrevorLawrence', 'JalenHurts',
  // Soccer / World Cup
  'Cristiano', 'neymarjr', 'USMNT',
  // MLB
  'shohei_ohtani',
  // General sports celebrities
  'ShannonSharpe', 'stephenasmith',
];

// ============================================================
// SIDELINE ARTICLE WRITER AGENT
// Takes an X post and writes a full Sideline article
// ============================================================
async function writeArticleFromPost(post) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a sports writer for Sideline, a fan-first sports media platform. 
Your voice is energetic, opinionated, and fan-focused — think Barstool meets ESPN but smarter and more authentic.

An athlete or sports figure just posted on X (Twitter). Write a short Sideline article about it.

POST DETAILS:
- Author: ${post.authorName} (@${post.authorUsername})
- Post text: "${post.text}"
- Has video: ${post.hasVideo ? 'YES' : 'NO'}
- Posted at: ${post.createdAt}
- Post URL: ${post.url}

ARTICLE REQUIREMENTS:
- Headline: punchy, fan-focused, 8-12 words max
- Subheadline: one sentence that adds context
- Body: 2-3 short paragraphs. Lead with what happened, add context/history, end with fan angle or what this means
- Tag: pick ONE from [Breaking, Video, Hot Take, Must See, Exclusive]
- Sport: detect which sport this is about
- Keep it under 250 words total
- Write like a real sports fan who also knows how to write

Respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "headline": "...",
  "subheadline": "...",
  "body": "...",
  "tag": "...",
  "sport": "...",
  "aiGenerated": true,
  "sourcePost": "${post.url}"
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  return JSON.parse(text);
}

// ============================================================
// X oEMBED - Gets the official embed HTML for any X post URL
// No API key needed — this is X's public oEmbed endpoint
// ============================================================
async function getXEmbed(tweetUrl) {
  try {
    const embedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=false&theme=dark`;
    const response = await fetch(embedUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      html: data.html,
      authorName: data.author_name,
      authorUrl: data.author_url,
    };
  } catch (err) {
    console.error('oEmbed error:', err.message);
    return null;
  }
}

// ============================================================
// FETCH RECENT POSTS FROM X (using RapidAPI Twitter endpoint)
// Set RAPIDAPI_KEY in Vercel env vars
// Alternative: use Nitter RSS feeds (free, no key needed)
// ============================================================
async function fetchRecentPostsFromX(username) {
  // Option A: RapidAPI (paid, reliable)
  if (process.env.RAPIDAPI_KEY) {
    try {
      const response = await fetch(
        `https://twitter154.p.rapidapi.com/user/tweets?username=${username}&limit=5&include_replies=false&include_pinned=false`,
        {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'twitter154.p.rapidapi.com',
          },
        }
      );
      const data = await response.json();
      return (data.results || []).map(tweet => ({
        id: tweet.tweet_id,
        text: tweet.text,
        authorUsername: username,
        authorName: tweet.user?.name || username,
        hasVideo: tweet.media_url?.some(m => m.includes('video')) || tweet.video !== null,
        createdAt: tweet.creation_date,
        url: `https://twitter.com/${username}/status/${tweet.tweet_id}`,
        likeCount: tweet.favorite_count || 0,
        retweetCount: tweet.retweet_count || 0,
      }));
    } catch (err) {
      console.error(`RapidAPI fetch error for @${username}:`, err.message);
      return [];
    }
  }

  // Option B: Nitter RSS (free fallback — no API key needed)
  // Uses public Nitter instances to get recent tweets as RSS
  try {
    const nitterInstances = [
      'nitter.net',
      'nitter.privacydev.net',
      'nitter.poast.org',
    ];
    for (const instance of nitterInstances) {
      try {
        const rssUrl = `https://${instance}/${username}/rss`;
        const response = await fetch(rssUrl, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) continue;
        const xml = await response.text();
        return parseNitterRSS(xml, username);
      } catch {
        continue;
      }
    }
    return [];
  } catch (err) {
    console.error(`Nitter fetch error for @${username}:`, err.message);
    return [];
  }
}

// Parse Nitter RSS XML into post objects
function parseNitterRSS(xml, username) {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  return items.slice(0, 5).map(item => {
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [])[1] || '';
    const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    const tweetId = link.split('/status/')[1] || Date.now().toString();
    const hasVideo = title.toLowerCase().includes('video') || item.includes('video');

    return {
      id: tweetId,
      text: title,
      authorUsername: username,
      authorName: username,
      hasVideo,
      createdAt: pubDate,
      url: link.replace(/nitter\.[^/]+/, 'twitter.com'),
      likeCount: 0,
      retweetCount: 0,
    };
  });
}

// ============================================================
// DEDUP - Track processed post IDs to avoid re-publishing
// Uses in-memory cache (upgrade to KV store for production)
// ============================================================
const processedIds = new Set();

function isAlreadyProcessed(postId) {
  return processedIds.has(postId);
}

function markAsProcessed(postId) {
  processedIds.add(postId);
  // Keep set from growing unbounded
  if (processedIds.size > 1000) {
    const firstKey = processedIds.values().next().value;
    processedIds.delete(firstKey);
  }
}

// ============================================================
// SHOULD WE WRITE ABOUT THIS POST?
// Filter logic — not every post deserves an article
// ============================================================
function isNewsworthy(post) {
  const text = post.text.toLowerCase();

  // Always cover videos
  if (post.hasVideo) return true;

  // High engagement signals
  if (post.likeCount > 5000) return true;
  if (post.retweetCount > 1000) return true;

  // Sports keywords that signal something worth covering
  const keywords = [
    'announcement', 'signing', 'trade', 'contract', 'injured', 'injury',
    'retiring', 'retirement', 'breaking', 'official', 'excited', 'blessed',
    'championship', 'record', 'history', 'drafted', 'released', 'cut',
    'comeback', 'surgery', 'cleared', 'return', 'first', 'never before',
  ];

  return keywords.some(kw => text.includes(kw));
}

// ============================================================
// MAIN HANDLER
// This is what Vercel calls — treat as a cron endpoint
// ============================================================
module.exports = async (req, res) => {
  // Security: only allow cron calls or manual trigger with secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = {
    scanned: 0,
    articlesGenerated: 0,
    articles: [],
    errors: [],
  };

  console.log(`[agent-social] Starting scan of ${ATHLETE_WATCHLIST.length} accounts...`);

  for (const username of ATHLETE_WATCHLIST) {
    try {
      const posts = await fetchRecentPostsFromX(username);
      results.scanned += posts.length;

      for (const post of posts) {
        // Skip if already processed
        if (isAlreadyProcessed(post.id)) continue;

        // Skip if not newsworthy
        if (!isNewsworthy(post)) {
          markAsProcessed(post.id);
          continue;
        }

        console.log(`[agent-social] Newsworthy post from @${username}: ${post.text.substring(0, 60)}...`);

        // Get official X embed
        const embed = await getXEmbed(post.url);

        // Write the article with AI
        const article = await writeArticleFromPost(post);

        // Build the final Sideline article object
        const sidelineArticle = {
          id: `social-${post.id}`,
          type: 'social-article',
          ...article,
          embed: embed?.html || null,
          embedAuthor: embed?.authorName || post.authorName,
          sourceUrl: post.url,
          sourceUsername: post.authorUsername,
          publishedAt: new Date().toISOString(),
          thumbnail: `https://unavatar.io/twitter/${post.authorUsername}`,
          hasVideo: post.hasVideo,
        };

        markAsProcessed(post.id);
        results.articles.push(sidelineArticle);
        results.articlesGenerated++;

        console.log(`[agent-social] ✅ Article written: "${article.headline}"`);

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error(`[agent-social] Error processing @${username}:`, err.message);
      results.errors.push({ username, error: err.message });
    }
  }

  console.log(`[agent-social] Done. Generated ${results.articlesGenerated} articles from ${results.scanned} posts scanned.`);

  return res.status(200).json(results);
};
