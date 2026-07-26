"use client";
import { useState } from "react";
import { apiAction } from "@/components/actions/api-action";
import { PollCard } from "@/components/games/poll-card";

export function PollVoteCard({
  pollId,
  question,
  options,
  initialSelected,
  closed,
}: {
  pollId: string;
  question: string;
  options: readonly { id: string; label: string; votes: number }[];
  initialSelected?: string;
  closed: boolean;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [voted, setVoted] = useState(Boolean(initialSelected));
  const [voteCounts, setVoteCounts] = useState(
    Object.fromEntries(options.map((option) => [option.id, option.votes])),
  );
  const [error, setError] = useState("");

  async function vote() {
    if (!selected) return;
    setError("");
    try {
      await apiAction("poll-votes", { pollId, optionId: selected });
      setVoteCounts((counts) => ({
        ...counts,
        [selected]: (counts[selected] ?? 0) + 1,
      }));
      setVoted(true);
    } catch (err) {
      if (err instanceof Error && err.message !== "AUTH_REQUIRED")
        setError(err.message);
    }
  }

  return (
    <div>
      <PollCard
        question={question}
        options={options.map((option) => ({
          ...option,
          votes: voteCounts[option.id] ?? option.votes,
        }))}
        selected={selected}
        disabled={closed || voted}
        onChange={setSelected}
        onVote={vote}
      />
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
