"use client";

import { useEffect, useState } from "react";
import { Flame, TrendingUp, Users, Zap, Bot } from "lucide-react";
import type { GamePulse } from "@/lib/services/game-pulse";

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="bg-surface-2 h-2 w-full rounded-full">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function GamePulsePanel({ gameId }: { gameId: string }) {
  const [pulse, setPulse] = useState<GamePulse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchPulse() {
      try {
        const res = await fetch(`/api/scout/pulse/${gameId}`);
        if (res.ok && active) {
          setPulse(await res.json());
        }
      } catch {
        // silent
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchPulse();
    const interval = setInterval(fetchPulse, 30_000); // refresh every 30s
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [gameId]);

  if (loading) {
    return (
      <div className="border-brand/30 bg-surface-1 animate-pulse rounded-lg border p-6">
        <div className="bg-surface-2 h-4 w-32 rounded" />
      </div>
    );
  }

  if (!pulse) return null;

  return (
    <div className="border-brand/30 bg-surface-1 space-y-4 rounded-lg border p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Flame className="text-brand h-5 w-5" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Game Pulse</h3>
      </div>

      {/* Momentum */}
      {pulse.momentum && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Momentum
            </span>
            <span className="font-bold">
              {pulse.momentum.leader} ▲ {pulse.momentum.percent}%
            </span>
          </div>
          <ProgressBar percent={pulse.momentum.percent} color="bg-brand" />
        </div>
      )}

      {/* Crowd Confidence */}
      {pulse.crowdConfidence.length === 2 && (
        <div className="space-y-1">
          <span className="text-text-muted flex items-center gap-1 text-sm">
            <Users className="h-3.5 w-3.5" /> Crowd Confidence
          </span>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-20 truncate font-medium">
              {pulse.crowdConfidence[0].team}
            </span>
            <div className="flex-1">
              <div className="bg-surface-2 flex h-4 overflow-hidden rounded-full">
                <div
                  className="bg-brand flex items-center justify-center text-[10px] font-bold transition-all duration-700"
                  style={{ width: `${pulse.crowdConfidence[0].percent}%` }}
                >
                  {pulse.crowdConfidence[0].percent > 15
                    ? `${pulse.crowdConfidence[0].percent}%`
                    : ""}
                </div>
                <div
                  className="bg-surface-3 flex items-center justify-center text-[10px] font-bold transition-all duration-700"
                  style={{ width: `${pulse.crowdConfidence[1].percent}%` }}
                >
                  {pulse.crowdConfidence[1].percent > 15
                    ? `${pulse.crowdConfidence[1].percent}%`
                    : ""}
                </div>
              </div>
            </div>
            <span className="w-20 truncate text-right font-medium">
              {pulse.crowdConfidence[1].team}
            </span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold">{pulse.fansActive.toLocaleString()}</p>
          <p className="text-text-muted text-xs">Fans Active</p>
        </div>
        <div>
          <p className="text-lg font-bold">{pulse.flashThreads}</p>
          <p className="text-text-muted text-xs">Flash Threads</p>
        </div>
        <div>
          <p className="text-lg font-bold">
            {pulse.topPrediction ? (
              <span className="flex items-center justify-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                <span className="max-w-[80px] truncate text-sm">
                  {pulse.topPrediction}
                </span>
              </span>
            ) : (
              "—"
            )}
          </p>
          <p className="text-text-muted text-xs">Top Prediction</p>
        </div>
      </div>

      {/* SCOUT Commentary */}
      {pulse.scoutCommentary && (
        <div className="border-brand/20 bg-surface-2 rounded-md border p-3">
          <div className="flex items-start gap-2">
            <Bot className="text-brand mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm leading-relaxed">{pulse.scoutCommentary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
