import Link from "next/link";

const links = [
  ["Help", "/help"],
  ["Community guidelines", "/guidelines"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
] as const;

export function Footer() {
  return (
    <footer className="border-border-subtle bg-surface-1 mt-auto border-t">
      <div className="page-container grid gap-6 py-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-display text-xl font-black">
            <span className="text-brand">FAN</span>TAKES
          </p>
          <p className="text-text-secondary mt-2 max-w-md text-sm">
            Scores bring fans in. Conversations keep them. Identity brings them
            back.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
          {links.map(([label, href]) => (
            <Link
              className="text-text-secondary hover:text-text-primary text-sm hover:underline"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-text-muted text-xs md:col-span-2">
          FanTakes is for sports conversation and predictions, never wagering.
        </p>
      </div>
    </footer>
  );
}
