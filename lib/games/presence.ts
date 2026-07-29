import { kv } from "@vercel/kv";

const PRESENCE_TTL_SECONDS = 90;

function configured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function key(gameId: string) {
  return `game-presence:${gameId}`;
}

export async function heartbeatGamePresence({
  gameId,
  visitorId,
  now = new Date(),
}: {
  gameId: string;
  visitorId: string;
  now?: Date;
}) {
  if (!configured()) return { activeUsers: null, available: false };
  const presenceKey = key(gameId);
  const cutoff = now.getTime() - PRESENCE_TTL_SECONDS * 1000;
  const pipeline = kv.pipeline();
  pipeline.zadd(presenceKey, { score: now.getTime(), member: visitorId });
  pipeline.zremrangebyscore(presenceKey, 0, cutoff);
  pipeline.expire(presenceKey, PRESENCE_TTL_SECONDS + 30);
  pipeline.zcard(presenceKey);
  const results = await pipeline.exec();
  const activeUsers = Number(results.at(-1) ?? 0);
  return { activeUsers, available: true };
}
