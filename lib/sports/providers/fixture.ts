import fs from "node:fs/promises";
import path from "node:path";

import type { SportsProviderAdapter } from "@/lib/sports/service";
import type { Contest } from "@/lib/sports/types";

export function fixtureProviderAdapter(
  fixturePath: string,
): SportsProviderAdapter {
  let contests: Contest[] | null = null;
  return {
    provider: "espn",
    async fetchSchedule(league, { date } = {}) {
      if (!contests) {
        const absolute = path.resolve(process.cwd(), fixturePath);
        contests = JSON.parse(await fs.readFile(absolute, "utf8")) as Contest[];
      }
      return contests.filter(
        (contest) =>
          contest.league.key === league.key &&
          (!date || contest.competitionDate === date),
      );
    },
  };
}
