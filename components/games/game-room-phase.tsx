import { Archive, Clock3, MessageCircle, Trophy } from "lucide-react";

import { Card } from "@/components/ui/foundations";
import type { GamePhase } from "@/lib/sports/game-lifecycle";

const content: Record<
  GamePhase,
  { title: string; description: string; icon: typeof Clock3 }
> = {
  SCHEDULED: {
    title: "Pregame room",
    description:
      "Follow the game, make a winner prediction, and start the matchup conversation.",
    icon: Clock3,
  },
  PREGAME: {
    title: "First pitch is approaching",
    description:
      "Predictions remain open until the server-side lock. Game discussion is active now.",
    icon: Clock3,
  },
  LIVE: {
    title: "Live conversation",
    description:
      "Scores come from the canonical game feed. New Takes remain attached to this permanent room.",
    icon: MessageCircle,
  },
  HALFTIME: {
    title: "Break in play",
    description:
      "The room stays live while official game data reports a halftime or intermission state.",
    icon: MessageCircle,
  },
  FINAL: {
    title: "Final archive",
    description:
      "The final score, predictions, and fan conversation remain available at this permanent URL.",
    icon: Trophy,
  },
  POSTPONED: {
    title: "Game postponed",
    description:
      "This room remains available and will reactivate when the provider publishes a new schedule.",
    icon: Archive,
  },
  CANCELLED: {
    title: "Game cancelled",
    description:
      "Predictions are voided safely, while existing conversation remains available.",
    icon: Archive,
  },
};

export function GameRoomPhase({ phase }: { phase: GamePhase }) {
  const state = content[phase];
  const Icon = state.icon;
  return (
    <Card className="mb-6 flex items-start gap-3">
      <Icon aria-hidden className="text-brand mt-0.5 size-5 shrink-0" />
      <div>
        <h2 className="font-bold">{state.title}</h2>
        <p className="text-text-secondary mt-1 text-sm">{state.description}</p>
      </div>
    </Card>
  );
}
