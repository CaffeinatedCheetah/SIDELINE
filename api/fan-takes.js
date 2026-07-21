import { kv } from '@vercel/kv';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const raw = await kv.lrange('takes:all', 0, limit - 1);
      const takes = (raw||[]).map(t => typeof t==='string'?JSON.parse(t):t);
      if (req.query.sort === 'fire') takes.sort((a,b)=>(b.fireCount||0)-(a.fireCount||0));
      return res.status(200).json({ takes });
    } catch { return res.status(200).json({ takes: [] }); }
  }
  if (req.method === 'POST') {
    try {
      const body = typeof req.body==='string'?JSON.parse(req.body):req.body;
      if (body.id && body.vote) {
        const key = 'take:'+body.id;
        const take = await kv.get(key);
        if (take) {
          const t = typeof take==='string'?JSON.parse(take):take;
          if (body.vote==='fire') t.fireCount=(t.fireCount||0)+1;
          if (body.vote==='ice') t.iceCount=(t.iceCount||0)+1;
          await kv.set(key, JSON.stringify(t));
        }
        return res.status(200).json({ success: true });
      }
      if (body.text) {
        const id = Date.now().toString();
        const take = { id, text: body.text, sport: body.sport||'general', username: body.username||'FanNation', fireCount: 0, iceCount: 0, replyCount: 0, createdAt: new Date().toISOString() };
        await kv.set('take:'+id, JSON.stringify(take));
        await kv.lpush('takes:all', JSON.stringify(take));
        await kv.ltrim('takes:all', 0, 999);
        return res.status(200).json({ success: true, take });
      }
      return res.status(400).json({ error: 'Missing required fields' });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }
  return res.status(405).end();
}
