export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      {" "}
      <div>
        {eyebrow && (
          <p className="text-brand mb-2 text-xs font-bold tracking-[.18em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl font-black tracking-tight md:text-5xl">
          {title}
        </h1>
        <p className="text-text-secondary mt-3 max-w-2xl">{description}</p>
      </div>
      {action}
    </header>
  );
}
