import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchPanel } from "@/components/search/search-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("live content search", () => {
  it("exposes teams, leagues, takes, and Flash Thread filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                users: [],
                teams: [],
                leagues: [],
                games: [],
                communities: [],
                debates: [],
                takes: [],
                flashThreads: [
                  {
                    id: "thread-1",
                    gameId: "game-1",
                    title: "Late goal changes everything",
                    game: {
                      league: { abbreviation: "MLS" },
                      homeTeam: { abbreviation: "DET" },
                      awayTeam: { abbreviation: "CHI" },
                    },
                  },
                ],
              },
            }),
            { headers: { "content-type": "application/json" } },
          ),
        ),
      ),
    );

    render(<SearchPanel initialQuery="goal" initialType="flash-threads" />);

    for (const label of ["Teams", "Leagues", "Takes", "Flash Threads"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    await waitFor(() =>
      expect(
        screen.getByRole("link", {
          name: "Late goal changes everything · MLS",
        }),
      ).toHaveAttribute("href", "/games/game-1"),
    );
  });
});
