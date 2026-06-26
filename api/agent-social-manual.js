// api/agent-social-manual.js
// SIDELINE - Manual Social Article Generator
// POST { tweetUrl } → fetches oEmbed + writes AI article → returns JSON

import Anthropic from '@anthropic-ai/sdk';

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
    console.error('[agent-social-manual] oEmbed error:', err.message);
    return null;
  }
}

function extractTweetText(embedHtml) {
  if (!embedHtml) return '';
  const pMatch = embedHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!pMatch) return '';
  return pMatch[1]
    .replace(/<a[^>]*>([^<]*)<\/a>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function writeArticleFromPost(post) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a sports writer for Sideline, a fan-first sports media platform.
Your voice is energetic, opinionated, and fan-focused — think Barstool meets ESPN but smarter and more authentic.

An athlete or sports figure just posted on X (Twitter). Write a short Sideline article about it.

POST DETAILS:
- Author: ${post.authorName} (@${post.authorUsername})
- Post text: "${post.text}"
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tweetUrl } = req.body || {};
  if (!tweetUrl) return res.status(400).json({ error: 'tweetUrl is required' });

  const urlMatch = tweetUrl.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/);
  if (!urlMatch) return res.status(400).json({ error: 'Invalid tweet/X URL' });

  const authorUsername = urlMatch[1];

  const embed = await getXEmbed(tweetUrl);
  const tweetText = extractTweetText(embed?.html);

  const post = {
    authorName: embed?.authorName || authorUsername,
    authorUsername,
    text: tweetText || `Post by @${authorUsername}`,
    createdAt: new Date().toISOString(),
    url: tweetUrl,
  };

  try {
    const article = await writeArticleFromPost(post);

    return res.status(200).json({
      id: `manual-${Date.now()}`,
      type: 'social-article',
      ...article,
      embed: embed?.html || null,
      embedAuthor: embed?.authorName || authorUsername,
      sourceUrl: tweetUrl,
      sourceUsername: authorUsername,
      publishedAt: new Date().toISOString(),
      thumbnail: `https://unavatar.io/twitter/${authorUsername}`,
    });
  } catch (err) {
    console.error('[agent-social-manual] Article generation error:', err.message);
    return res.status(500).json({ error: 'Failed to generate article', detail: err.message });
  }
}
