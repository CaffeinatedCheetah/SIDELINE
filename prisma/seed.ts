import {
  PrismaClient,
  DebateStatus,
  GameStatus,
  HallPeriod,
} from "@prisma/client";

const db = new PrismaClient();

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PREVIEW_SEED !== "true"
  )
    throw new Error(
      "Production-mode seed is disabled. Set ALLOW_PREVIEW_SEED=true only for an approved preview database.",
    );

  const football = await db.sport.upsert({
    where: { key: "football" },
    update: {},
    create: { key: "football", name: "Football" },
  });
  const basketball = await db.sport.upsert({
    where: { key: "basketball" },
    update: {},
    create: { key: "basketball", name: "Basketball" },
  });
  const nfl = await db.league.upsert({
    where: { key: "nfl" },
    update: {},
    create: {
      sportId: football.id,
      key: "nfl",
      name: "National Football League",
      abbreviation: "NFL",
    },
  });
  const nba = await db.league.upsert({
    where: { key: "nba" },
    update: {},
    create: {
      sportId: basketball.id,
      key: "nba",
      name: "National Basketball Association",
      abbreviation: "NBA",
    },
  });

  const teams = await Promise.all(
    [
      ["det-lions", "Detroit Lions", "DET", nfl.id, "Detroit"],
      ["chi-bears", "Chicago Bears", "CHI", nfl.id, "Chicago"],
      ["det-pistons", "Detroit Pistons", "DET", nba.id, "Detroit"],
      ["bos-celtics", "Boston Celtics", "BOS", nba.id, "Boston"],
    ].map(([key, name, abbreviation, leagueId, city]) =>
      db.team.upsert({
        where: { key },
        update: {},
        create: { key, name, abbreviation, leagueId, city },
      }),
    ),
  );

  const demoUsers = await Promise.all(
    [
      ["demo@fantakes.local", "fantakes-demo", "FanTakes Demo"],
      ["maya@fantakes.local", "demo-maya", "FanTakes Demo — Maya"],
      ["devon@fantakes.local", "demo-devon", "FanTakes Demo — Devon"],
    ].map(([email, handle, displayName]) =>
      db.user.upsert({
        where: { email },
        update: {
          handle,
          normalizedHandle: handle.toLowerCase(),
          displayName,
          name: displayName,
        },
        create: {
          email,
          emailVerified: new Date(),
          handle,
          normalizedHandle: handle.toLowerCase(),
          displayName,
          name: displayName,
          onboardedAt: new Date(),
          profile: {
            create: {
              favoriteSports: [football.id, basketball.id],
              favoriteTeams: teams.slice(0, 2).map((team) => team.id),
            },
          },
          preferences: { create: { onboardingStep: 5 } },
        },
      }),
    ),
  );

  const now = new Date();
  const liveGame = await db.game.upsert({
    where: { providerRef: "demo-nfl-live" },
    update: {},
    create: {
      providerRef: "demo-nfl-live",
      leagueId: nfl.id,
      homeTeamId: teams[0].id,
      awayTeamId: teams[1].id,
      scheduledAt: new Date(now.getTime() - 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 45 * 60 * 1000),
      status: GameStatus.LIVE,
      homeScore: 17,
      awayScore: 14,
      period: "3rd",
      clock: "08:42",
    },
  });
  await db.game.upsert({
    where: { providerRef: "demo-nba-upcoming" },
    update: {},
    create: {
      providerRef: "demo-nba-upcoming",
      leagueId: nba.id,
      homeTeamId: teams[2].id,
      awayTeamId: teams[3].id,
      scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      status: GameStatus.SCHEDULED,
    },
  });

  const community = await db.community.upsert({
    where: { slug: "motor-city-faithful" },
    update: {
      name: "FanTakes Official — Motor City",
      description:
        "Official FanTakes discussion space for Detroit game days and roster conversations.",
    },
    create: {
      ownerId: demoUsers[1].id,
      slug: "motor-city-faithful",
      name: "FanTakes Official — Motor City",
      description:
        "Official FanTakes discussion space for Detroit game days and roster conversations.",
      rules: "Be specific. Debate the take, not the fan. No slurs or threats.",
    },
  });
  await db.communityMember.upsert({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: demoUsers[0].id,
      },
    },
    update: {},
    create: {
      communityId: community.id,
      userId: demoUsers[0].id,
      rulesAcceptedAt: now,
    },
  });

  const debate = await db.debate.upsert({
    where: { slug: "nfc-north-best-defense" },
    update: {
      title: "Official prompt: Who has the NFC North's best defense?",
    },
    create: {
      creatorId: demoUsers[1].id,
      gameId: liveGame.id,
      communityId: community.id,
      slug: "nfc-north-best-defense",
      title: "Official prompt: Who has the NFC North's best defense?",
      prompt: "Make the case using this season's performance, not reputation.",
      status: DebateStatus.OPEN,
      opensAt: now,
      closesAt: new Date(now.getTime() + 7 * 86400000),
      options: {
        create: [
          { key: "lions", label: "Detroit Lions", displayOrder: 1 },
          { key: "bears", label: "Chicago Bears", displayOrder: 2 },
          { key: "other", label: "Another team", displayOrder: 3 },
        ],
      },
    },
  });

  const take = await db.take.upsert({
    where: { id: "00000000-0000-4000-8000-000000000101" },
    update: {
      body: "[Official demo] Detroit's pressure packages are deciding this game before the snap.",
    },
    create: {
      id: "00000000-0000-4000-8000-000000000101",
      authorId: demoUsers[2].id,
      gameId: liveGame.id,
      communityId: community.id,
      body: "[Official demo] Detroit's pressure packages are deciding this game before the snap.",
    },
  });
  await db.take.upsert({
    where: { id: "00000000-0000-4000-8000-000000000102" },
    update: {
      body: "[Official demo] Consistency on third down puts Detroit ahead right now.",
    },
    create: {
      id: "00000000-0000-4000-8000-000000000102",
      authorId: demoUsers[1].id,
      debateId: debate.id,
      body: "[Official demo] Consistency on third down puts Detroit ahead right now.",
    },
  });

  await Promise.all(
    [
      ["first-take", "First Take", "Post your first take.", "message-circle"],
      [
        "perfect-read",
        "Perfect Read",
        "Make a correct game prediction.",
        "target",
      ],
      [
        "community-builder",
        "Community Builder",
        "Contribute constructively to a community.",
        "users",
      ],
    ].map(([key, name, description, icon]) =>
      db.badge.upsert({
        where: { key },
        update: {},
        create: { key, name, description, icon },
      }),
    ),
  );

  await db.fanScoreEvent.upsert({
    where: { idempotencyKey: "seed:first-take" },
    update: {},
    create: {
      userId: demoUsers[2].id,
      eventType: "QUALITY_TAKE",
      sourceType: "TAKE",
      sourceId: take.id,
      points: 10,
      reason: "Posted a substantive game take",
      idempotencyKey: "seed:first-take",
    },
  });
  await db.hallOfFlameEntry.upsert({
    where: {
      period_periodStart_rank_leagueId_communityId: {
        period: HallPeriod.WEEKLY,
        periodStart: new Date("2026-07-20T00:00:00Z"),
        rank: 1,
        leagueId: nfl.id,
        communityId: community.id,
      },
    },
    update: {},
    create: {
      period: HallPeriod.WEEKLY,
      periodStart: new Date("2026-07-20T00:00:00Z"),
      rank: 1,
      score: 84.25,
      takeId: take.id,
      leagueId: nfl.id,
      communityId: community.id,
      reasons: { quality: 0.9, conversation: 0.8, trust: 0.75 },
    },
  });

  console.info("Seeded FanTakes development data. All records are demo-only.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
