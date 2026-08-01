import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { callClaude, parseJSON } from "@/lib/services/scout-content";
import { gatherSportsBrief } from "@/lib/services/scout-news";
import type { SportsBrief } from "@/lib/services/scout-news";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOT_EMAIL = "scout@fantakes.local";
const BOT_HANDLE = "fantakes-bot";
const MAX_TAKES_PER_DAY = 8;
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
          bio: "Automated account. Takes and debates posted here are AI-generated conversation starters, not news, analysis, or advice.",
          favoriteSports: [],
          favoriteTeams: [],
        },
      },
    },
  });
}

const SYSTEM_PROMPT = `You are FanTakes Scout, a sports fan who watches EVERYTHING — NFL, NBA, MLB, NHL, MLS, WNBA, college football, UFC/MMA, soccer, F1, boxing, tennis. You react to what's happening RIGHT NOW like a real fan scrolling Twitter and Reddit.

Your takes should sound like someone who:
- Just watched the game and has OPINIONS
- Reads r/nba, r/nfl, r/baseball, r/soccer, r/mma
- Knows the storylines, rivalries, and context
- Has strong but fun takes, not boring analysis
- Uses specific player names, team names, and real situations
- Covers DIFFERENT sports in each batch (not all NBA or all NFL)

You are NOT a news source. Frame everything as opinion, prediction, or question.
Never invent specific scores or stats unless given to you.
Keep takes under 260 characters — punchy, not essays.`;

function buildPrompt(brief: SportsBrief): string {
  const sections: string[] = [];

  if (brief.liveGames.length > 0) {
    sections.push("=== LIVE RIGHT NOW ===");
    for (const g of brief.liveGames.slice(0, 10)) {
      sections.push(`[${g.league}] ${g.awayTeam} ${g.awayScore ?? 0} @ ${g.homeTeam} ${g.homeScore ?? 0} — ${g.statusDetail}${g.situation ? ` | ${g.situation}` : ""}`);
    }
  }

  if (brief.recentResults.length > 0) {
    sections.push("\n=== FINAL SCORES (today) ===");
    for (const g of brief.recentResults.slice(0, 10)) {
      sections.push(`[${g.league}] ${g.awayTeam} ${g.awayScore ?? 0} @ ${g.homeTeam} ${g.homeScore ?? 0} — ${g.statusDetail}`);
    }
  }

  if (brief.headlines.length > 0) {
    sections.push("\n=== BREAKING / TRENDING NEWS ===");
    for (const h of brief.headlines.slice(0, 15)) {
      sections.push(`[${h.sport}] ${h.title} (${h.source})`);
    }
  }

  if (brief.redditTrending.length > 0) {
    sections.push("\n=== HOT ON REDDIT ===");
    for (const r of brief.redditTrending.slice(0, 10)) {
      sections.push(`r/${r.subreddit} (⬆${r.score}): ${r.title}`);
    }
  }

  const hasData = sections.length > 0;

  return `${hasData ? sections.join("\n") : "No live data available right now."}

Based on what's ACTUALLY happening above, write:

1. 5 short fan takes (each under 260 characters). REQUIREMENTS:
   - Each take MUST reference a specific team, player, or event from the data above
   - Cover at LEAST 3 different sports/leagues across your 5 takes
   - React like a fan who just saw this happen — not generic "hot takes"
   - Mix of: game reactions, bold predictions, spicy opinions, trash talk, hype
   - Use emojis sparingly (1 max per take, or none)

2. One debate: a question fans would actually argue about RIGHT NOW based on the news above.
   - title: under 130 chars, framed as a question
   - prompt: 1-2 sentence setup, under 300 chars
   - teamA / teamB: two opposing positions (can be team names or stance labels)

3. One community discussion starter (under 260 chars): an open question that could spark a real thread.

Return ONLY JSON:
{"takes":["...","...","...","...","..."],"debate":{"title":"...","prompt":"...","teamA":"...","teamB":"..."},"communityStarter":"..."}`;
}

type GeneratedContent = {
  takes?: string[];
  debate?: { title?: string; prompt?: string; teamA?: string; teamB?: string };
  communityStarter?: string;
};

async function recentBotTakeBodies(botId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await db.take.findMany({
    where: { authorId: botId, createdAt: { gte: since } },
    select: { body: true },
  });
  return new Set(rows.map((row) => row.body.trim().toLowerCase()));
}

async function randomActiveCommunity() {
  const communities = await db.community.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (communities.length === 0) return null;
  return communities[Math.floor(Math.random() * communities.length)];
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(rateLimitKey(request, "scout"), {
    limit: 4,
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

  // Gather real-time sports data from ESPN, Reddit, and RSS
  const brief = await gatherSportsBrief();
  const prompt = buildPrompt(brief);

  const text = await callClaude({ prompt, system: SYSTEM_PROMPT, maxTokens: 1200 });
  const generated = parseJSON<GeneratedContent>(text);

  if (!generated)
    return NextResponse.json(
      { ok: false, error: "Content generation returned no usable JSON", sourcesScanned: { liveGames: brief.liveGames.length, headlines: brief.headlines.length, reddit: brief.redditTrending.length } },
      { status: 200 },
    );

  const seenRecently = await recentBotTakeBodies(bot.id);
  const created = { takes: [] as string[], debate: null as string | null, communityStarter: null as string | null, sourcesScanned: { liveGames: brief.liveGames.length, results: brief.recentResults.length, headlines: brief.headlines.length, reddit: brief.redditTrending.length } };
  let remaining = MAX_TAKES_PER_DAY - takesToday;

  for (const raw of generated.takes ?? []) {
    if (remaining <= 0) break;
    const body = raw.trim().slice(0, TAKE_MAX_LENGTH);
    if (!body || seenRecently.has(body.toLowerCase())) continue;
    await db.take.create({ data: { authorId: bot.id, body } });
    seenRecently.add(body.toLowerCase());
    created.takes.push(body);
    remaining--;
  }

  if (debateToday === 0 && generated.debate) {
    const { title, prompt: debatePrompt, teamA, teamB } = generated.debate;
    const validTitle = title?.trim().slice(0, 140) ?? "";
    const validPrompt = debatePrompt?.trim().slice(0, 2000) ?? "";
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

  if (remaining > 0 && generated.communityStarter) {
    const community = await randomActiveCommunity();
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
