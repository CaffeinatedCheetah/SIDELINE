import { checkRateLimit, getClientIP } from './_ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.', videos: [] });
  }

  const YT_KEY = process.env.YOUTUBE_API_KEY;
  const sport = req.query.sport || 'all';

  const CHANNELS = {
    all:      ['UCDVYQ4Zhbm3S2dlz7P1GBDg','UCEjOSbbaOfgnfRODEEMYlCw','UCoLrcjPV5PbUrUyXq5mjc_A','UCqZQlzSHbVJrwrn5XvzrzcA','UCznv__14nznPLH1T2YMDbhA','UCvgfXK4nTYKudb0rFR6noSQ','UCB_qr75-ydFVKSF9Dmo6izg','UCB-3oiAkRKvMQbVQkjD_f5A','UCW-QMcKMSMBHlTj0SVFdNrQ','UCpcTrCXblq78Gn28FGMocqQ'],
    american: ['UCDVYQ4Zhbm3S2dlz7P1GBDg','UCEjOSbbaOfgnfRODEEMYlCw','UCoLrcjPV5PbUrUyXq5mjc_A','UCB-3oiAkRKvMQbVQkjD_f5A'],
    soccer:   ['UCqZQlzSHbVJrwrn5XvzrzcA','UCW-QMcKMSMBHlTj0SVFdNrQ','UCpcTrCXblq78Gn28FGMocqQ','UCsb5wjy_TfzfUMDFECDaADQ','UC8ZpZgeEVHCMn9PfnOyEhAA'],
    rugby:    ['UCznv__14nznPLH1T2YMDbhA'],
    combat:   ['UCvgfXK4nTYKudb0rFR6noSQ'],
    racing:   ['UCB_qr75-ydFVKSF9Dmo6izg'],
  };

  const TAGS = {
    'UCDVYQ4Zhbm3S2dlz7P1GBDg': 'NFL',
    'UCEjOSbbaOfgnfRODEEMYlCw': 'NBA',
    'UCoLrcjPV5PbUrUyXq5mjc_A': 'MLB',
    'UCqZQlzSHbVJrwrn5XvzrzcA': 'EPL',
    'UCznv__14nznPLH1T2YMDbhA': 'Rugby',
    'UCvgfXK4nTYKudb0rFR6noSQ': 'UFC',
    'UCB_qr75-ydFVKSF9Dmo6izg': 'F1',
    'UCB-3oiAkRKvMQbVQkjD_f5A': 'NHL',
    'UCW-QMcKMSMBHlTj0SVFdNrQ': 'MLS',
    'UCpcTrCXblq78Gn28FGMocqQ': 'UCL',
    'UCsb5wjy_TfzfUMDFECDaADQ': 'La Liga',
    'UC8ZpZgeEVHCMn9PfnOyEhAA': 'Soccer',
  };

  if (!YT_KEY) {
    return res.status(500).json({ error: 'YouTube API key not configured', videos: [] });
  }

  try {
    const channels = CHANNELS[sport] || CHANNELS['all'];
    const results = await Promise.all(channels.map(async id => {
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${id}&maxResults=4&order=date&type=video&key=${YT_KEY}`;
        const r = await fetch(url);
        const d = await r.json();
        return (d.items || [])
          .filter(item => item.id?.videoId)
          .map(item => ({
            id:        item.id.videoId,
            tag:       TAGS[id] || 'Sports',
            title:     item.snippet.title,
            thumb:     item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channel:   item.snippet.channelTitle,
            published: item.snippet.publishedAt,
          }));
      } catch { return []; }
    }));

    const videos = results.flat();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ videos });
  } catch (err) {
    return res.status(500).json({ error: err.message, videos: [] });
  }
}
