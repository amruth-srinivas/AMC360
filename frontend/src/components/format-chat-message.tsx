import type { ReactNode } from "react";

type FormatVariant = "default" | "inverse";

function parseInline(text: string, variant: FormatVariant, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  const linkClass =
    variant === "inverse"
      ? "font-medium text-sky-100 underline hover:text-white"
      : "font-medium text-sky-600 underline hover:text-sky-700";

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${index}`;
    if (match[2]) {
      nodes.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={key}>{match[3]}</em>);
    } else if (match[4]) {
      nodes.push(<u key={key}>{match[4]}</u>);
    } else if (match[5] && match[6]) {
      nodes.push(
        <a key={key} href={match[6]} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {match[5]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
    index += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

function parseListLine(line: string, variant: FormatVariant, keyPrefix: string): ReactNode {
  const ordered = line.match(/^(\d+)\.\s+(.*)$/);
  if (ordered) {
    return (
      <span className="flex gap-2">
        <span className="shrink-0">{ordered[1]}.</span>
        <span>{parseInline(ordered[2], variant, `${keyPrefix}-o`)}</span>
      </span>
    );
  }

  const bullet = line.match(/^-\s+(.*)$/);
  if (bullet) {
    return (
      <span className="flex gap-2">
        <span className="shrink-0">•</span>
        <span>{parseInline(bullet[1], variant, `${keyPrefix}-b`)}</span>
      </span>
    );
  }

  return <>{parseInline(line, variant, keyPrefix)}</>;
}

export function FormatChatMessage({
  text,
  variant = "default",
}: {
  text: string;
  variant?: FormatVariant;
}) {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, lineIndex) => (
        <p key={lineIndex} className={lineIndex > 0 ? "mt-1" : undefined}>
          {line.length === 0 ? <br /> : parseListLine(line, variant, `l${lineIndex}`)}
        </p>
      ))}
    </>
  );
}
