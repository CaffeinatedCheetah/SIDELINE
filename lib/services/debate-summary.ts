// SCOUT Debate Summary — AI-generated summary of both sides
// Instead of reading 300 comments, users get:
// "Fans supporting Team A believe... Fans supporting Team B argue..."
// Current vote split, most persuasive argument.

import { callClaude, parseJSON } from "@/lib/services/scout-content";
import { db } from "@/lib/db/client";

export type DebateSummary = {
  sideA: { label: string; argument: string; votePercent: number };
  sideB: { label: string; argument: string; votePercent: number };
  mostPersuasive: string;
  totalVotes: number;
  generatedAt: string;
};

export async function generateDebateSummary(
  debateId: string,
): Promise<DebateSummary | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const debate = await db.debate.findUnique({
    where: { id: debateId },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      votes: {
        include: {
          option: { select: { label: true, key: true } },
          user: { select: { handle: true } },
        },
      },
    },
  });

  if (!debate || debate.options.length < 2) return null;

  const optionA = debate.options[0];
  const optionB = debate.options[1];
  const votesA = debate.votes.filter(
    (v) => v.option?.key === optionA.key,
  );
  const votesB = debate.votes.filter(
    (v) => v.option?.key === optionB.key,
  );
  const total = votesA.length + votesB.length;
  if (total === 0) return null;

  const percentA = Math.round((votesA.length / total) * 100);
  const percentB = 100 - percentA;

  // Get related takes/comments for context
  const relatedTakes = await db.take.findMany({
    where: {
      OR: [
        { body: { contains: optionA.label, mode: "insensitive" } },
        { body: { contains: optionB.label, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { body: true },
  });

  const prompt = `You are SCOUT, summarizing a fan debate on FanTakes.

Debate: ${debate.title}
Context: ${debate.prompt}

Side A: "${optionA.label}" (${percentA}% of votes, ${votesA.length} voters)
Side B: "${optionB.label}" (${percentB}% of votes, ${votesB.length} voters)

Related fan opinions:
${relatedTakes.map((t) => `- ${t.body}`).join("\n")}

Return JSON:
{
  "sideAArgument": "Fans supporting ${optionA.label} believe..." (under 150 chars),
  "sideBArgument": "Fans supporting ${optionB.label} argue..." (under 150 chars),
  "mostPersuasive": "The strongest single argument in this debate is..." (under 120 chars)
}

Write like a smart fan summarizing the discourse, not a neutral journalist. Return ONLY JSON.`;

  try {
    const text = await callClaude({ prompt, maxTokens: 400 });
    const parsed = parseJSON<{
      sideAArgument?: string;
      sideBArgument?: string;
      mostPersuasive?: string;
    }>(text);
    if (!parsed) return null;

    return {
      sideA: {
        label: optionA.label,
        argument: parsed.sideAArgument || "",
        votePercent: percentA,
      },
      sideB: {
        label: optionB.label,
        argument: parsed.sideBArgument || "",
        votePercent: percentB,
      },
      mostPersuasive: parsed.mostPersuasive || "",
      totalVotes: total,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
