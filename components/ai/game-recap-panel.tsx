import { BookOpen, ShieldCheck } from "lucide-react";

import { RecapFeedback } from "@/components/ai/recap-feedback";
import { LocalDateTime } from "@/components/ui/local-date-time";
import type { GameRecap } from "@/lib/ai/schemas/game-recap";

export function GameRecapPanel({
  artifact,
  signedIn,
  feedback,
}: {
  artifact: {
    id: string;
    status: string;
    content: GameRecap | null;
    generatedAt: Date | null;
  } | null;
  signedIn: boolean;
  feedback?: "HELPFUL" | "NOT_HELPFUL";
}) {
  if (!artifact)
    return (
      <RecapShell>
        <p className="text-text-secondary text-sm">
          A SIDELINE recap has not been generated for this game.
        </p>
      </RecapShell>
    );
  if (artifact.status !== "READY" || !artifact.content) {
    const messages: Record<string, string> = {
      PENDING: "The recap is queued.",
      GENERATING: "The recap is being prepared from verified game data.",
      INSUFFICIENT_DATA:
        "There are not enough verified game moments to create a trustworthy recap.",
      DISABLED:
        "AI recaps are currently disabled. Verified moments and fan discussion remain available below.",
      FAILED:
        "The recap is temporarily unavailable. The rest of the Game Room is unaffected.",
      STALE: "An updated recap is being prepared.",
    };
    return (
      <RecapShell>
        <p aria-live="polite" className="text-text-secondary text-sm">
          {messages[artifact.status] ?? "The recap is unavailable."}
        </p>
      </RecapShell>
    );
  }
  const recap = artifact.content;
  return (
    <RecapShell>
      <p className="text-brand-primary text-xs font-bold tracking-[0.16em] uppercase">
        {recap.headline}
      </p>
      <h2 className="font-display mt-2 text-2xl font-black">{recap.dek}</h2>
      <p className="text-text-secondary mt-3 leading-7">{recap.summary}</p>
      {recap.keyMoments.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {recap.keyMoments.map((moment) => (
            <article
              key={moment.momentId}
              id={`recap-moment-${moment.momentId}`}
              className="border-border-subtle bg-surface-2/70 rounded-2xl border p-4"
            >
              <span className="text-brand-primary text-xs font-bold uppercase">
                {moment.importance} impact
              </span>
              <h3 className="mt-1 font-bold">{moment.label}</h3>
              <p className="text-text-secondary mt-1 text-sm">
                {moment.description}
              </p>
            </article>
          ))}
        </div>
      ) : null}
      {recap.fanConversation.summary ? (
        <div className="bg-brand-primary/8 mt-5 rounded-2xl p-4">
          <h3 className="font-bold">Fan conversation</h3>
          <p className="text-text-secondary mt-1 text-sm">
            {recap.fanConversation.summary}
          </p>
        </div>
      ) : null}
      {recap.caveats.length ? (
        <ul className="text-text-muted mt-4 list-disc pl-5 text-xs">
          {recap.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}
      {artifact.generatedAt ? (
        <p className="text-text-muted mt-4 text-xs">
          Generated <LocalDateTime value={artifact.generatedAt.toISOString()} />
        </p>
      ) : null}
      <RecapFeedback
        artifactId={artifact.id}
        signedIn={signedIn}
        initialValue={feedback}
      />
    </RecapShell>
  );
}

function RecapShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="sideline-recap-title"
      className="border-brand-primary/25 bg-surface relative my-6 overflow-hidden rounded-3xl border p-5 shadow-sm md:p-7"
    >
      <div className="from-brand-primary via-brand-secondary to-brand-primary pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="sideline-recap-title"
          className="font-display flex items-center gap-2 text-xl font-black"
        >
          <BookOpen aria-hidden className="text-brand-primary h-5 w-5" />
          SIDELINE Recap
        </h2>
        <span className="border-border-subtle text-text-secondary inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
          AI-assisted
        </span>
      </div>
      <p className="text-text-muted mb-4 text-xs">
        Generated from verified game data and public SIDELINE activity. This is
        not official league reporting.
      </p>
      {children}
    </section>
  );
}
