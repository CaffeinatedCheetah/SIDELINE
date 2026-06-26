// api/_score-utils.js
// Shared scoring primitives and content normalizers for algorithm-web and algorithm-app

export function recencyScore(publishedAt) {
  const h = (Date.now() - new Date(publishedAt || 0).getTime()) / 3_600_000;
  if (h < 1)  return 1.00;
  if (h < 6)  return 0.80;
  if (h < 24) return 0.60;
  if (h < 72) return 0.30;
  return 0.10;
}

export function engagementScore(item) {
  if (item.isLive)           return 1.00;
  if (item.breaking)         return 1.00;
  if (item.trending)         return 0.80;
  if (item.type === 'take')  return 0.70;
  if (item.exclusive)        return 0.65;
  if (item.type === 'video') return 0.65;
  if (item.type === 'ai')    return 0.55;
  return 0.40;
}

export function trendingScore(item) {
  if (item.breaking || item.tag === 'Breaking')  return 1.00;
  if (item.trending  || item.tag === 'Hot Take') return 0.75;
  return 0.20;
}

export function fromNews(articles) {
  return articles.map(a => ({
    id:          a.url || a.title,
    type:        a.breaking ? 'breaking' : (a.trending ? 'trending' : 'news'),
    title:       a.title,
    summary:     '',
    image:       a.image || a.urlToImage || '',
    url:         a.url || '#',
    sport:       a.sport || '',
    source:      typeof a.source === 'object' ? a.source.name : (a.source || 'News'),
    publishedAt: a.publishedAt,
    breaking:    !!a.breaking,
    trending:    !!a.trending,
    exclusive:   !!a.exclusive,
    tag:         a.breaking ? 'Breaking' : '',
    isLive:      false,
  }));
}

export function fromVideos(videos) {
  return videos.map(v => ({
    id:          v.id || v.url,
    type:        'video',
    title:       v.title,
    summary:     '',
    image:       v.thumb || '',
    url:         v.url || `https://www.youtube.com/watch?v=${v.id}`,
    sport:       v.tag || '',
    source:      v.channel || 'Video',
    publishedAt: v.published || v.publishedAt || new Date().toISOString(),
    tag:         'Video',
    isLive:      false,
  }));
}

export function fromAI(articles) {
  return articles.map(a => ({
    id:          a.id,
    type:        'ai',
    title:       a.headline,
    summary:     a.subheadline || '',
    image:       a.thumbnail || '',
    url:         a.sourceUrl || '#',
    sport:       a.sport || '',
    source:      `⚡ Sideline AI · @${a.sourceUsername || ''}`,
    publishedAt: a.publishedAt,
    embed:       a.embed || null,
    tag:         a.tag || '',
    breaking:    a.tag === 'Breaking',
    trending:    a.tag === 'Breaking' || a.tag === 'Hot Take',
    exclusive:   false,
    isLive:      false,
  }));
}
