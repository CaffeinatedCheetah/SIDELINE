function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtNum(n) {
  n = parseInt(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function wrapText(text, maxCpl, maxLines) {
  const words = String(text || '').split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (test.length <= maxCpl) { line = test; }
    else { if (line) lines.push(line); line = word.slice(0, maxCpl); }
    if (lines.length >= maxLines) { lines[maxLines - 1] += '…'; break; }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

const SPORT_COLORS = {
  NBA: '#C65334', NFL: '#4F86A6', Soccer: '#3FB950', EPL: '#3FB950',
  Rugby: '#8AB4F8', UFC: '#FF3D3D', F1: '#D29922', MLB: '#3FB950',
  NHL: '#58A6FF', WNBA: '#FF8C00', default: '#FF3D3D',
};

export default async function handler(req, res) {
  const {
    type = 'take', text = '', sport = 'Sports',
    fires = '0', ices = '0', user = '@fan', title = '', source = '',
  } = req.query;

  const color  = SPORT_COLORS[sport] || SPORT_COLORS.default;
  const fireN  = parseInt(fires) || 0;
  const iceN   = parseInt(ices)  || 0;
  const total  = fireN + iceN;
  const fp     = total ? Math.round(fireN / total * 100) : 50;
  const barW   = Math.round(1080 * fp / 100);

  const defs = `<defs>
    <linearGradient id="gbg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#161B22"/>
    </linearGradient>
    <linearGradient id="gbar" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${esc(color)}"/>
      <stop offset="100%" stop-color="#FF8C00"/>
    </linearGradient>
  </defs>`;

  const base = (inner) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${defs}` +
    `<rect width="1200" height="630" fill="url(#gbg)"/>` +
    `<rect width="1200" height="8" fill="url(#gbar)"/>` +
    `<text x="60" y="76" font-family="Impact,Arial Black,sans-serif" font-size="32" fill="${esc(color)}" letter-spacing="6">SIDELINE</text>` +
    `<text x="60" y="100" font-family="Courier New,monospace" font-size="13" fill="#484F58" letter-spacing="3">FANTAKES.APP</text>` +
    inner + `</svg>`;

  let svg;

  if (type === 'take') {
    const raw   = String(text || title || '').slice(0, 220);
    const lines = wrapText(raw, 34, 4);
    const tY    = lines.length <= 2 ? 290 : 248;

    svg = base(
      `<text x="${1200 - esc(sport).length * 13 - 24}" y="74" font-family="Courier New,monospace" font-size="16" font-weight="700" fill="${esc(color)}">${esc(sport)}</text>` +
      `<text x="60" y="164" font-family="Courier New,monospace" font-size="18" fill="#484F58" letter-spacing="4">🔥 FAN TAKE</text>` +
      lines.map((l, i) =>
        `<text x="60" y="${tY + i * 56}" font-family="Impact,Arial Black,sans-serif" font-size="46" fill="#FFFFFF">${esc(l)}</text>`
      ).join('') +
      `<text x="60" y="528" font-family="Courier New,monospace" font-size="17" fill="#8B949E">${esc(user)}</text>` +
      `<rect x="60" y="548" width="1080" height="10" rx="5" fill="#30363D"/>` +
      `<rect x="60" y="548" width="${barW}" height="10" rx="5" fill="url(#gbar)"/>` +
      `<text x="60"   y="594" font-family="Courier New,monospace" font-size="20" fill="${esc(color)}">🔥 ${esc(fmtNum(fireN))}</text>` +
      `<text x="600"  y="594" font-family="Courier New,monospace" font-size="20" fill="#F0EDE8" text-anchor="middle">${esc(fp)}% FIRE RATE</text>` +
      `<text x="1140" y="594" font-family="Courier New,monospace" font-size="20" fill="#58A6FF" text-anchor="end">❄️ ${esc(fmtNum(iceN))}</text>`
    );

  } else if (type === 'article') {
    const raw   = String(title || text || '').slice(0, 120);
    const lines = wrapText(raw, 38, 3);
    const src   = String(source || 'SIDELINE AI').toUpperCase().slice(0, 40);

    svg = base(
      `<rect x="60"  y="140" width="180" height="36" rx="4" fill="${esc(color)}"/>` +
      `<text x="76"  y="165" font-family="Courier New,monospace" font-size="14" font-weight="700" fill="#000000">⚡ BREAKING</text>` +
      `<text x="${1200 - esc(sport).length * 13 - 24}" y="163" font-family="Courier New,monospace" font-size="16" font-weight="700" fill="${esc(color)}">${esc(sport)}</text>` +
      lines.map((l, i) =>
        `<text x="60" y="${232 + i * 66}" font-family="Impact,Arial Black,sans-serif" font-size="52" fill="#FFFFFF">${esc(l)}</text>`
      ).join('') +
      `<text x="60"   y="588" font-family="Courier New,monospace" font-size="16" fill="#484F58">${esc(src)}</text>` +
      `<text x="1140" y="588" font-family="Courier New,monospace" font-size="18" fill="${esc(color)}" text-anchor="end">READ MORE →</text>`
    );

  } else {
    svg = base(
      `<text x="600" y="290" font-family="Impact,Arial Black,sans-serif" font-size="110" fill="#FF3D3D" text-anchor="middle" letter-spacing="6">SIDELINE</text>` +
      `<text x="600" y="375" font-family="Courier New,monospace" font-size="24" fill="#8B949E" text-anchor="middle" letter-spacing="3">LIVE SPORTS · FAN TAKES · TRENDING</text>` +
      `<text x="600" y="430" font-family="Courier New,monospace" font-size="20" fill="#FF3D3D" text-anchor="middle">FANTAKES.APP</text>`
    );
  }

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  return res.status(200).send(svg);
}
