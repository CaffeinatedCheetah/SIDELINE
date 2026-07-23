export function LegalPage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: readonly { heading: string; body: string }[];
}) {
  return (
    <article className="page-container max-w-3xl py-12">
      <h1 className="font-display text-5xl font-black">{title}</h1>
      <p className="text-text-secondary mt-4 text-lg">{description}</p>
      <div className="mt-10 grid gap-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-2xl font-black">
              {section.heading}
            </h2>
            <p className="text-text-secondary mt-3 leading-7">{section.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
