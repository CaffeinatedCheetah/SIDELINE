import {
  CircleDot,
  Circle,
  Goal,
  Shield,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const sportIcons: Record<string, LucideIcon> = {
  baseball: CircleDot,
  basketball: Circle,
  football: Shield,
  hockey: Goal,
  soccer: Goal,
};

export function LeagueMark({
  abbreviation,
  sportKey,
  className,
}: {
  abbreviation: string;
  sportKey: string;
  className?: string;
}) {
  const Icon = sportIcons[sportKey] ?? Trophy;
  return (
    <span
      className={cn(
        "bg-surface-1/80 relative grid size-14 shrink-0 place-items-center rounded-2xl border border-[color:var(--league-primary)] shadow-lg",
        className,
      )}
      aria-label={`${abbreviation} league mark`}
    >
      <Icon
        aria-hidden
        className="size-7 text-[color:var(--league-secondary)]"
      />
      <span className="bg-surface-1 text-text-primary absolute -right-1 -bottom-1 rounded-full border border-[color:var(--league-primary)] px-1.5 py-0.5 text-[0.6rem] font-black">
        {abbreviation}
      </span>
    </span>
  );
}
