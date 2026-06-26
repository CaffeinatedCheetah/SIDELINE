export default async function handler(req, res) {
  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const host    = req.headers.host || 'fantakes.app';
  const base    = `${proto}://${host}`;
  const today   = new Date().toISOString().split('T')[0];

  let articles = [];
  try {
    const r = await fetch(`${base}/api/articles-store`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) articles = await r.json();
  } catch {}

  const pages = [
    { loc: base,                     pri: '1.0', freq: 'always'  },
    { loc: `${base}/#scores`,        pri: '0.9', freq: 'always'  },
    { loc: `${base}/#takes`,         pri: '0.9', freq: 'always'  },
    { loc: `${base}/#trending`,      pri: '0.8', freq: 'always'  },
    { loc: `${base}/#videos`,        pri: '0.8', freq: 'hourly'  },
    { loc: `${base}/blog.html`,      pri: '0.8', freq: 'hourly'  },
    { loc: `${base}/#soccer`,        pri: '0.7', freq: 'hourly'  },
    { loc: `${base}/#american`,      pri: '0.7', freq: 'hourly'  },
    { loc: `${base}/#rugby`,         pri: '0.6', freq: 'daily'   },
    { loc: `${base}/#combat`,        pri: '0.6', freq: 'daily'   },
    { loc: `${base}/#racing`,        pri: '0.6', freq: 'daily'   },
    ...articles.slice(0, 200).map(a => ({
      loc:    `${base}/blog.html?article=${encodeURIComponent(a.id)}`,
      mod:    a.publishedAt ? a.publishedAt.split('T')[0] : today,
      pri:    '0.7',
      freq:   'weekly',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${p.mod || today}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.pri}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  return res.status(200).send(xml);
}
