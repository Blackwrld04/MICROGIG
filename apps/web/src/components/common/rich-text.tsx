import { Fragment } from "react";

/**
 * Minimal, XSS-safe renderer for seller descriptions: paragraphs separated by blank
 * lines and "- " bullet lists. Everything renders as React text — raw HTML is never
 * injected.
 */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => l.startsWith("- "));
        const intro = lines.filter((l) => !l.startsWith("- "));
        return (
          <Fragment key={i}>
            {intro.length > 0 ? <p>{intro.join(" ")}</p> : null}
            {bullets.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {bullets.map((b, j) => (
                  <li key={j}>{b.slice(2)}</li>
                ))}
              </ul>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
