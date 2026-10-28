import type { ReactNode } from "react";

// ============================================================
// SADA — Article body renderer
//
// The canonical renderer for `blog_posts.content`. The public article
// page and the admin editor preview both use this, so what an editor
// sees while writing is literally what ships. Extracted from
// blog.$slug.tsx — do not fork a second copy of this parser.
//
// Supported syntax (documented in the Blog editor's formatting guide):
//   ## Heading          → h2
//   ### Subheading      → h3
//   > Quote             → blockquote
//   - item  /  * item   → bulleted list
//   1. item             → numbered list
//   anything else       → paragraph
// ============================================================

export const ARTICLE_SYNTAX_HELP: { syntax: string; result: string }[] = [
  { syntax: "## Section heading", result: "Large section heading" },
  { syntax: "### Subheading", result: "Smaller subheading" },
  { syntax: "> A quotable line", result: "Pull quote" },
  { syntax: "- First point", result: "Bulleted list" },
  { syntax: "1. First step", result: "Numbered list" },
  { syntax: "Plain text on its own line", result: "Paragraph" },
];

export function ArticleContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (!t) {
      i++;
      continue;
    }

    if (t.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="text-3xl md:text-4xl font-bold mt-14 mb-5 tracking-tight">
          {t.slice(3)}
        </h2>,
      );
      i++;
      continue;
    }
    if (t.startsWith("### ")) {
      blocks.push(
        <h3 key={key++} className="text-xl md:text-2xl font-bold mt-10 mb-3 tracking-tight">
          {t.slice(4)}
        </h3>,
      );
      i++;
      continue;
    }
    if (t.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={key++}
          className="my-10 ps-6 border-s-4 border-primary text-xl md:text-2xl font-medium leading-snug text-foreground/90 italic"
        >
          {t.slice(2).replace(/^"|"$/g, "")}
        </blockquote>,
      );
      i++;
      continue;
    }
    // Numbered / bulleted list grouping
    if (/^(\d+\.\s|[-*]\s)/.test(t)) {
      const items: string[] = [];
      const ordered = /^\d+\./.test(t);
      while (i < lines.length && /^(\d+\.\s|[-*]\s)/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(\d+\.\s|[-*]\s)/, ""));
        i++;
      }
      blocks.push(
        ordered ? (
          <ol
            key={key++}
            className="my-6 space-y-2 list-decimal ps-6 marker:text-primary marker:font-bold text-lg leading-[1.8]"
          >
            {items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ol>
        ) : (
          <ul
            key={key++}
            className="my-6 space-y-2 list-disc ps-6 marker:text-primary text-lg leading-[1.8]"
          >
            {items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        ),
      );
      continue;
    }
    blocks.push(
      <p key={key++} className="my-5 text-lg leading-[1.85] text-foreground/90">
        {t}
      </p>,
    );
    i++;
  }

  return <div className="prose-content">{blocks}</div>;
}
