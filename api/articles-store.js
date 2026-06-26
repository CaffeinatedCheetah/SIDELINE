// api/articles-store.js
// Persists manually published social articles to /tmp/articles.json
// Note: /tmp is per-instance on Vercel — survives warm requests, resets on cold start.
// For durable storage upgrade to Vercel KV.

import { readFileSync, writeFileSync } from 'fs';

const FILE = '/tmp/sideline-articles.json';

function readArticles() {
  try { return JSON.parse(readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function saveArticles(articles) {
  writeFileSync(FILE, JSON.stringify(articles));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(readArticles());
  }

  if (req.method === 'POST') {
    const article = req.body;
    if (!article?.id || !article?.headline) {
      return res.status(400).json({ error: 'Invalid article — id and headline required' });
    }
    const articles = readArticles();
    if (!articles.find(a => a.id === article.id)) {
      articles.unshift(article);
      saveArticles(articles.slice(0, 100));
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id query param required' });
    const articles = readArticles().filter(a => a.id !== id);
    saveArticles(articles);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
