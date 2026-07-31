import Link from "next/link";

const MENTION = /(@[a-z0-9-]{3,30})/gi;

export function MentionText({ children }: { children: string }) {
  return (
    <>
      {children.split(MENTION).map((part, index) =>
        part.startsWith("@") ? (
          <Link
            key={`${part}-${index}`}
            href={`/u/${part.slice(1)}`}
            className="text-brand font-semibold hover:underline"
          >
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}
