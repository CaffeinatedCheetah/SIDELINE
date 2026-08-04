// SCOUT Daily Briefing — personalized homepage greeting
// "Good Evening. Your Yankees won. Judge hit 2 HR.
//  Cowboys camp begins tomorrow. Three debates are trending."
//
// Pulls from: user's followed teams, ESPN results, active debates,
// hot flash threads. Generates a personal briefing via Claude.

import { callClaude } from "@/lib/services/scout-content";
import { db } from "@/lib/db/client";
import { gatherSportsBrief } from "@/lib/services/scout-news";

export type DailyBriefing = {
  greeting: string;
  bullets: string[];
  generatedAt: string;
};

function getTimeOfDay(): string {
  const hour = new Date().getUTCHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export async function generateDailyBriefing(
  userId?: string,
): Promise<DailyBriefing | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  // Gather user context if logged in
  let followedTeams: string[] = [];
  let userName: string | null = null;

  if (userId) {
    const [user, follows] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      }),
      db.gameFollow.findMany({
        where: { userId },
        include: { game: { include: { homeTeam: true, awayTeam: true } } },
        take: 10,
      }),
    ]);
    userName = user?.displayName || null;
    followedTeams = follows.flatMap((f) => [
      f.game.homeTeam.name,
      f.game.awayTeam.name,
    ]);
  }

  // Get real sports data
  const brief = await gatherSportsBrief();

  // Get platform activity
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [debates, takes] = await Promise.all([
    db.debate.count({ where: { status: "OPEN", createdAt: { gte: since } } }),
    db.take.count({ where: { createdAt: { gte: since } } }),
  ]);

  const timeOfDay = getTimeOfDay();
  const resultsSection = brief.recentResults
    .slice(0, 8)
    .map((g) => `[${g.league}] ${g.awayTeam} ${g.awayScore} @ ${g.homeTeam} ${g.homeScore} (${g.statusDetail})`)
    .join("\n");

  const liveSection = brief.liveGames
    .slice(0, 5)
    .map((g) => `[${g.league}] ${g.awayTeam} ${g.awayScore} @ ${g.homeTeam} ${g.homeScore} (${g.statusDetail})`)
    .join("\n");

  const headlinesSection = brief.headlines
    .slice(0, 8)
    .map((h) => `[${h.sport}] ${h.title}`)
    .join("\n");

  const prompt = `You are SCOUT, the AI companion on FanTakes. Write a personalized daily briefing.

Time: Good ${timeOfDay}${userName ? `, ${userName}` : ""}.

${followedTeams.length > 0 ? `User follows these teams: ${followedTeams.join(", ")}. Prioritize news about them.` : "User hasn't followed any teams yet — give a general sports briefing."}

Today's results:
${resultsSection || "No completed games yet today."}

Live right now:
${liveSection || "No live games."}

Headlines:
${headlinesSection || "No breaking news."}

Platform: ${debates} active debates, ${takes} takes posted in the last 24h.

Write:
1. A greeting line ("Good ${timeOfDay}${userName ? `, ${userName}` : ""}.")
2. 4-6 bullet points, each under 80 characters. Lead with results for followed teams if available. Include:
   - Key game results (mention scores)
   - One breaking headline
   - Platform activity summary ("X debates trending" or "Y takes posted")
   - One thing coming up next

Keep it casual and fan-friendly, like a smart friend catching you up. Not robotic.

Return JSON: {"greeting": "...", "bullets": ["...", "..."]}`;

  try {
    const text = await callClaude({ prompt, maxTokens: 400 });
    const parsed = text ? JSON.parse(
      text.replace(/```json|```/g, "").trim(),
    ) as { greeting?: string; bullets?: string[] } : null;
    if (!parsed?.greeting || !parsed?.bullets) return null;

    return {
      greeting: parsed.greeting,
      bullets: parsed.bullets.slice(0, 6),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
