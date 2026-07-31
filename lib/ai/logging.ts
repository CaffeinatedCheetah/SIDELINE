export function logAiEvent(event: string, metadata: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      scope: "sideline-ai",
      event,
      at: new Date().toISOString(),
      ...metadata,
    }),
  );
}
