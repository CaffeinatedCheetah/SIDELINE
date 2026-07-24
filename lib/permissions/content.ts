export function canEditContent(input: {
  actorId: string;
  authorId: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  createdAt: Date;
  now?: Date;
}) {
  if (input.role === "ADMIN" || input.role === "MODERATOR") return true;
  return (
    input.actorId === input.authorId &&
    (input.now ?? new Date()).getTime() - input.createdAt.getTime() <=
      15 * 60 * 1000
  );
}

export function canModerate(role: "USER" | "MODERATOR" | "ADMIN") {
  return role === "MODERATOR" || role === "ADMIN";
}
