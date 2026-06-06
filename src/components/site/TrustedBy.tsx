const LOGOS = [
  "Noor Coffee",
  "Maven Studio",
  "Atlas Realty",
  "Olive House",
  "Lumen",
  "Verde & Co.",
  "Northbeam",
  "Field Notes",
];

export function TrustedBy() {
  return (
    <section className="px-4 py-12 md:py-16 border-y border-border bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <p className="text-center text-xs font-semibold tracking-[0.3em] text-muted-foreground">
          TRUSTED BY GROWING BRANDS
        </p>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6 items-center">
          {LOGOS.map((name) => (
            <div
              key={name}
              className="text-center text-sm md:text-base font-display font-bold tracking-wider text-muted-foreground/70 hover:text-primary transition-colors cursor-default"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
