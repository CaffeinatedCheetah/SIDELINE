import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { callClaude, parseJSON } from "@/lib/services/scout-content";

// SCOUT (Prisma-based rebuild). Replaces api/agent-scout.js's breaking-news/
// viral-scan/SEO/repurpose/publisher tasks with a single job: seed the
// platform with real Take/Debate rows so it isn't empty for early users.
// api/agent-scout.js and its cron entry are removed; the other agent-*.js
// crons (agent-pulse, agent-social, agent-hunter, agent-rivals, push-notify)
// are untouched -- they still share _claude-api.js/_scout-memory.js with
// each other and are out of scope here.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOT_EMAIL = "scout@fantakes.local";
const BOT_HANDLE = "fantakes-bot";
const MAX_TAKES_PER_DAY = 5;
const TAKE_MAX_LENGTH = 1000;

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `debate-${Date.now()}`;
}

async function uniqueDebateSlug(title: string) {
  const base = slugify(title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Date.now().toString(36)}`;
    const existing = await db.debate.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function ensureBotUser() {
  return db.user.upsert({
    where: { email: BOT_EMAIL },
    update: {},
    create: {
      email: BOT_EMAIL,
      emailVerified: new Date(),
      handle: BOT_HANDLE,
      normalizedHandle: BOT_HANDLE,
      displayName: "FanTakes Scout",
      isOfficial: true,
      onboardedAt: new Date(),
      profile: {
        create: {
          // Honest disclosure per this project's own "platform-generated
          // content must be labeled" standard -- not just an internal flag.
          bio: "Automated account. Takes and debates posted here are AI-generated conversation starters, not news, analysis, or advice.",
          favoriteSports: [],
          favoriteTeams: [],
        },
      },
    },
  });
}

type TodaysGame = {
  id: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  league: { abbreviation: string };
};

async function todaysGames(): Promise<TodaysGame[]> {
  const start = startOfUtcDay();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return db.game.findMany({
    where: { scheduledAt: { gte: start, lt: end } },
    orderBy: { scheduledAt: "asc" },
    take: 10,
    select: {
      id: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      league: { select: { abbreviation: true } },
    },
  });
}

const SYSTEM_PROMPT = `You are FanTakes Scout, an automated content account for a sports fan
community platform. You write short, opinionated conversation-starters to
seed discussion. You are NOT a news source: never state specific scores,
injuries, stats, or events as fact unless they were explicitly given to you
in this prompt. Frame everything as opinion, prediction, or an open
question -- never invent facts.`;

type GeneratedContent = {
  takes?: string[];
  debate?: { title?: string; prompt?: string; teamA?: string; teamB?: string };
  communityStarter?: string;
};

async function generateContent(games: TodaysGame[]) {
  const prompt = games.length
    ? `Today's real games:
${games.map((g) => `- ${g.league.abbreviation}: ${g.awayTeam.name} at ${g.homeTeam.name}`).join("\n")}

Write:
1. 3 short fan takes (each under 260 characters), each a strong opinion or
   prediction about ONE of the matchups listed above. Use the exact team
   names given. Do not invent scores, injuries, or stats.
2. One debate: a short title framed as a question (under 130 characters),
   a one-sentence setup prompt (under 300 characters), and pick exactly one
   matchup from the list as the two debate options (teamA/teamB must be the
   exact team names from the list).
3. One community discussion-starter take (under 260 characters): an
   open-ended, evergreen sports question NOT tied to a specific unconfirmed
   live event.

Return ONLY JSON, no other text:
{"takes":["...","...","..."],"debate":{"title":"...","prompt":"...","teamA":"...","teamB":"..."},"communityStarter":"..."}`
    : `No real game data is available right now. Write general, evergreen sports
fan content instead -- do not invent specific games, scores, or events.

Write:
1. 3 short fan takes (each under 260 characters), general sports opinions or
   hot takes not tied to any specific unconfirmed game or event.
2. One debate: a short title framed as a question (under 130 characters), a
   one-sentence setup prompt (under 300 characters), and two distinct
   opposing position labels (teamA/teamB, under 80 characters each) fans
   could pick between.
3. One community discussion-starter take (under 260 characters): an
   open-ended, evergreen sports question.

Return ONLY JSON, no other text:
{"takes":["...","...","..."],"debate":{"title":"...","prompt":"...","teamA":"...","teamB":"..."},"communityStarter":"..."}`;

  const text = await callClaude({ prompt, system: SYSTEM_PROMPT, maxTokens: 900 });
  return parseJSON<GeneratedContent>(text);
}

async function recentBotTakeBodies(botId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.take.findMany({
    where: { authorId: botId, createdAt: { gte: since } },
    select: { body: true },
  });
  return new Set(rows.map((row) => row.body.trim().toLowerCase()));
}

async function topCommunity() {
  const communities = await db.community.findMany({
    where: { status: "ACTIVE" },
    include: { _count: { select: { members: true } } },
    orderBy: { members: { _count: "desc" } },
    take: 1,
  });
  return communities[0] ?? null;
}

export async function GET(request: Request) {
  // Vercel sets CRON_SECRET automatically when a project has one configured;
  // this check is a no-op (route stays reachable) until that env var is set.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(rateLimitKey(request, "scout"), {
    limit: 2,
    windowMs: 60 * 60_000,
  });
  if (!rateLimit.allowed)
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json(
      { ok: false, skipped: true, reason: "ANTHROPIC_API_KEY not set" },
      { status: 200 },
    );

  const bot = await ensureBotUser();
  const startOfDay = startOfUtcDay();

  const [takesToday, debateToday] = await Promise.all([
    db.take.count({
      where: { authorId: bot.id, createdAt: { gte: startOfDay } },
    }),
    db.debate.count({
      where: { creatorId: bot.id, createdAt: { gte: startOfDay } },
    }),
  ]);
  if (takesToday >= MAX_TAKES_PER_DAY && debateToday > 0)
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Daily content cap already reached",
    });

  const games = await todaysGames();
  const generated = await generateContent(games);
  if (!generated)
    return NextResponse.json(
      { ok: false, error: "Content generation returned no usable JSON" },
      { status: 200 },
    );

  const seenRecently = await recentBotTakeBodies(bot.id);
  const created = { takes: [] as string[], debate: null as string | null, communityStarter: null as string | null };
  let remaining = MAX_TAKES_PER_DAY - takesToday;

  // Regular takes -- never override or reference other users' content,
  // pure inserts only.
  for (const raw of generated.takes ?? []) {
    if (remaining <= 0) break;
    const body = raw.trim().slice(0, TAKE_MAX_LENGTH);
    if (!body || seenRecently.has(body.toLowerCase())) continue;
    await db.take.create({ data: { authorId: bot.id, body } });
    seenRecently.add(body.toLowerCase());
    created.takes.push(body);
    remaining--;
  }

  // Debate -- grounded in a real matchup when games exist; skip rather than
  // post malformed content if the model's output doesn't fit the schema's
  // real constraints (title 10-140, prompt 20-2000, 2 distinct options).
  if (debateToday === 0 && generated.debate) {
    const { title, prompt, teamA, teamB } = generated.debate;
    const validTitle = title?.trim().slice(0, 140) ?? "";
    const validPrompt = prompt?.trim().slice(0, 2000) ?? "";
    const options = [teamA?.trim(), teamB?.trim()].filter(
      (value): value is string => Boolean(value) && value!.length <= 80,
    );
    const distinctOptions =
      new Set(options.map((o) => o.toLowerCase())).size === options.length;
    if (
      validTitle.length >= 10 &&
      validPrompt.length >= 20 &&
      options.length === 2 &&
      distinctOptions
    ) {
      const slug = await uniqueDebateSlug(validTitle);
      const debate = await db.debate.create({
        data: {
          creatorId: bot.id,
          title: validTitle,
          prompt: validPrompt,
          slug,
          status: "OPEN",
          opensAt: new Date(),
          options: {
            create: options.map((label, index) => ({
              key: `option-${index + 1}`,
              label,
              displayOrder: index + 1,
            })),
          },
        },
      });
      created.debate = debate.slug;
    }
  }

  // Community discussion starter -- ensures bot membership first (a take
  // with a communityId requires active membership, same rule real users
  // follow) rather than bypassing that check for itself.
  if (remaining > 0 && generated.communityStarter) {
    const community = await topCommunity();
    if (community) {
      await db.communityMember.upsert({
        where: { communityId_userId: { communityId: community.id, userId: bot.id } },
        update: {},
        create: {
          communityId: community.id,
          userId: bot.id,
          rulesAcceptedAt: new Date(),
        },
      });
      const body = generated.communityStarter.trim().slice(0, TAKE_MAX_LENGTH);
      if (body && !seenRecently.has(body.toLowerCase())) {
        await db.take.create({
          data: { authorId: bot.id, communityId: community.id, body },
        });
        created.communityStarter = body;
      }
    }
  }

  return NextResponse.json({ ok: true, created });
}
