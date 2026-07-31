import type { PrismaClient } from "@prisma/client";

const BOT_EMAIL = "scout@fantakes.local";
const BOT_HANDLE = "fantakes-bot";

const OFFICIAL_COMMUNITIES = [
  {
    slug: "lakers-nation",
    name: "Lakers Nation",
    description:
      "For fans living and dying with the Lakers -- trades, lineups, and every possession that matters.",
    rules:
      "Be specific about the team, not just vibes. Debate the take, not the fan. No slurs or threats.",
  },
  {
    slug: "cowboys-country",
    name: "Cowboys Country",
    description:
      "America's Team, argued about by actual fans -- roster moves, game reactions, and next-week previews.",
    rules:
      "Be specific about the team, not just vibes. Debate the take, not the fan. No slurs or threats.",
  },
  {
    slug: "yankees-universe",
    name: "Yankees Universe",
    description:
      "Pinstripes talk for people who watch every game -- lineup decisions, bullpen management, and the standings race.",
    rules:
      "Be specific about the team, not just vibes. Debate the take, not the fan. No slurs or threats.",
  },
  {
    slug: "nba-debate-hub",
    name: "NBA Debate Hub",
    description:
      "League-wide NBA arguments that don't fit inside one team's fanbase -- MVP races, trade rumors, and power rankings.",
    rules:
      "Keep it league-wide, not just your team. Debate the take, not the fan. No slurs or threats.",
  },
  {
    slug: "college-football-talk",
    name: "College Football Talk",
    description:
      "Rankings, rivalries, and playoff arguments for fans who follow the sport beyond just their own school.",
    rules:
      "Cite the game or stat you're arguing from. Debate the take, not the fan. No slurs or threats.",
  },
] as const;

export async function seedOfficialCommunities(db: PrismaClient) {
  const bot = await db.user.upsert({
    where: { email: BOT_EMAIL },
    update: {},
    create: {
      email: BOT_EMAIL,
      emailVerified: new Date(),
      handle: BOT_HANDLE,
      normalizedHandle: BOT_HANDLE,
      displayName: "FanTakes Scout",
      onboardedAt: new Date(),
    },
  });

  for (const community of OFFICIAL_COMMUNITIES) {
    const row = await db.community.upsert({
      where: { slug: community.slug },
      update: {},
      create: { ownerId: bot.id, ...community },
    });
    await db.communityMember.upsert({
      where: { communityId_userId: { communityId: row.id, userId: bot.id } },
      update: {},
      create: {
        communityId: row.id,
        userId: bot.id,
        role: "OWNER",
        rulesAcceptedAt: new Date(),
      },
    });
  }

  return {
    botId: bot.id,
    communities: OFFICIAL_COMMUNITIES.map((community) => community.slug),
  };
}
