"use client";

import { useEffect, useState } from "react";
import { Bot, ChevronRight } from "lucide-react";
import type { DailyBriefing } from "@/lib/services/daily-briefing";

export function DailyBriefingCard() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchBriefing() {
      try {
        const res = await fetch("/api/scout/briefing");
        if (res.ok && active) {
          setBriefing(await res.json());
        }
      } catch {
        // silent — don't break homepage if briefing fails
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchBriefing();
    return () => { active = false; };
  }, []);

  if (dismissed || loading || !briefing) return null;

  return (
    <div className="border-brand/30 bg-gradient-to-br from-surface-1 to-surface-2 relative overflow-hidden rounded-xl border p-6">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="text-text-muted hover:text-text absolute right-3 top-3 text-xs"
        aria-label="Dismiss briefing"
      >
        ✕
      </button>

      {/* Scout icon + greeting */}
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-brand/20 flex h-10 w-10 items-center justify-center rounded-full">
          <Bot className="text-brand h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{briefing.greeting}</h2>
          <p className="text-text-muted text-xs">Your daily sports briefing from SCOUT</p>
        </div>
      </div>

      {/* Bullet points */}
      <ul className="space-y-2">
        {briefing.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <ChevronRight className="text-brand mt-0.5 h-4 w-4 shrink-0" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
