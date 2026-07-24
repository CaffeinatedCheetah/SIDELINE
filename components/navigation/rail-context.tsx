"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type RailContextValue = {
  content: ReactNode;
  setContent: (node: ReactNode) => void;
};

const RailContext = createContext<RailContextValue | null>(null);

export function RailProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  return (
    <RailContext.Provider value={{ content, setContent }}>
      {children}
    </RailContext.Provider>
  );
}

/**
 * Pages/components call this to register contextual content in the
 * persistent right rail (e.g. Live Stats, Trending Fans, Predictions
 * on a Game Room page). Unmounts clear their own content automatically.
 */
export function useRightRail(node: ReactNode) {
  const ctx = useContext(RailContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setContent(node);
    return () => ctx.setContent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);
}

/** Renders nothing when no page has registered rail content. */
export function RailSlot() {
  const ctx = useContext(RailContext);
  if (!ctx?.content) return null;
  return (
    <aside className="hidden shrink-0 lg:block lg:w-[var(--rail-width)]">
      <div className="sticky top-22 grid gap-4">{ctx.content}</div>
    </aside>
  );
}
