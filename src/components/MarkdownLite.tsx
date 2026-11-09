// Minimal, dependency-free renderer for the constrained markdown subset our
// own LLM output uses (headers, bold, bullet lists, paragraphs). Deliberately
// avoids dangerouslySetInnerHTML - everything renders through React elements.
import type { ReactNode } from "react";

// Matches **bold** before *italic* so a bold span isn't split into two
// stray single-asterisk matches first - models vary on which they use for
// emphasis (e.g. a label like "*FACTS*"), so both are handled.
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={`${keyPrefix}-${i}`}>{part.slice(1, -1)}</em>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc pl-5 space-y-1 my-2">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-[0.95em] leading-relaxed">
            {renderInline(item, `${key}-${i}`)}
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ")) {
      flushList(`ul-${idx}`);
      const level = line.startsWith("### ") ? 3 : line.startsWith("## ") ? 2 : 1;
      const content = line.replace(/^#+\s*/, "");
      const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      blocks.push(
        <Tag key={idx} className="font-semibold mt-3 mb-1 text-foreground">
          {renderInline(content, `h-${idx}`)}
        </Tag>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuffer.push(line.slice(2));
    } else if (line.length === 0) {
      flushList(`ul-${idx}`);
    } else {
      flushList(`ul-${idx}`);
      blocks.push(
        <p key={idx} className="text-[0.95em] leading-relaxed my-1.5 text-foreground/90">
          {renderInline(line, `p-${idx}`)}
        </p>
      );
    }
  });
  flushList("ul-end");

  return <div className={className}>{blocks}</div>;
}
