"use client";
import { useEffect, useRef, useState } from "react";
export function LiveGameRoom({
  gameId,
  initialStatus,
  reducedData = false,
}: {
  gameId: string;
  initialStatus: string;
  reducedData?: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [connection, setConnection] = useState<
    "connected" | "retrying" | "offline"
  >("connected");
  const latest = useRef(0);
  useEffect(() => {
    if (initialStatus !== "LIVE") return;
    const controller = new AbortController();
    const poll = async () => {
      const request = ++latest.current;
      try {
        const response = await fetch(`/api/v1/games/${gameId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (request !== latest.current) return;
        if (response.ok) {
          const body = (await response.json()) as { data?: { status: string } };
          if (body.data?.status) setStatus(body.data.status);
          setConnection("connected");
        } else setConnection("retrying");
      } catch {
        if (!controller.signal.aborted)
          setConnection(navigator.onLine ? "retrying" : "offline");
      }
    };
    const timer = setInterval(poll, reducedData ? 60_000 : 15_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [gameId, initialStatus, reducedData]);
  return (
    <p role="status" className="text-text-secondary mb-4 text-sm">
      Game status: <strong>{status}</strong> · {connection}
    </p>
  );
}
