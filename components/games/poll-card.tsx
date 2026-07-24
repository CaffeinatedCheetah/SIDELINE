"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/foundations";
import { Radio } from "@/components/ui/form-controls";

export interface PollCardProps {
  question: string;
  options: readonly { id: string; label: string; votes: number }[];
  selected?: string;
  disabled?: boolean;
  onChange?: (optionId: string) => void;
  onVote?: () => void;
}

export function PollCard({
  question,
  options,
  selected,
  disabled,
  onChange,
  onVote,
}: PollCardProps) {
  return (
    <Card>
      <fieldset disabled={disabled}>
        <legend className="font-display text-lg font-black">{question}</legend>
        <div className="mt-4">
          {options.map((option) => (
            <Radio
              key={option.id}
              name="poll-option"
              value={option.id}
              checked={selected === option.id}
              onChange={() => onChange?.(option.id)}
              label={option.label}
            />
          ))}
        </div>
        <Button
          className="mt-4 w-full"
          disabled={!selected || disabled}
          onClick={onVote}
          type="button"
        >
          Vote
        </Button>
      </fieldset>
    </Card>
  );
}
