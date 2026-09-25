import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tiny, safe renderer for ÖRZA's replies — no HTML injection, only React nodes.
 * Supports paragraphs, line breaks, "- " / "• " bullets, "1. " lists, **bold**, *italic*, `code`
 * and [links](/internal/path | https://…). Anything else renders as plain text.
 */

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[]; start: number };

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  let gap = true; // a blank line (or the start) precedes the current line
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim() || /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      gap = true;
      continue;
    }
    const prev = blocks[blocks.length - 1];
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    const numbered = line.match(/^\s*(\d{1,3})[.)]\s+(.+)$/);
    if (bullet) {
      if (prev?.kind === "ul") prev.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (prev?.kind === "ol") prev.items.push(numbered[2]);
      else blocks.push({ kind: "ol", items: [numbered[2]], start: Number(numbered[1]) || 1 });
    } else {
      const heading = line.match(/^\s*#{1,6}\s+(.+)$/);
      const text = heading ? `**${heading[1].replace(/\*\*/g, "")}**` : line;
      if (!gap && prev?.kind === "p") prev.lines.push(text);
      else blocks.push({ kind: "p", lines: [text] });
    }
    gap = false;
  }
  return blocks;
}

// 1: bold · 2,3: link text + href · 4: italic · 5: code
const INLINE = /\*\*([^\n]+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)|\*([^*\s](?:[^*\n]*?[^*\s])?)\*|`([^`\n]+)`/g;

const SAME_ORIGIN = "https://orza.invalid";

/**
 * Only same-site paths and plain https URLs become links. Backslashes and control characters are refused
 * outright ("/\evil.example" resolves off-site in browsers), and an internal path must still resolve to
 * this origin; the rendered href is the normalised path, never the raw model text.
 */
function safeHref(href: string): { internal: boolean; href: string } | null {
  if (!href || /[\\\u0000-\u001f\u007f]/.test(href)) return null;
  try {
    if (href.startsWith("/")) {
      if (href.startsWith("//")) return null;
      const u = new URL(href, SAME_ORIGIN);
      if (u.origin !== SAME_ORIGIN) return null;
      return { internal: true, href: `${u.pathname}${u.search}${u.hash}` };
    }
    const u = new URL(href);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password) return null;
    return { internal: false, href: u.toString() };
  } catch {
    return null;
  }
}

const linkClass =
  "font-medium text-[#0A6F82] underline decoration-[rgba(11,143,166,0.35)] underline-offset-[3px] transition-colors duration-150 ease-orza hover:decoration-[#0B8FA6]";

function renderInline(text: string, keyPrefix: string, allowLinks = true): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = new RegExp(INLINE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyPrefix}.${m.index}`;
    if (m[1] != null) {
      out.push(
        <strong key={k} className="font-semibold text-orza-strong">
          {renderInline(m[1], k, allowLinks)}
        </strong>
      );
    } else if (m[2] != null && m[3] != null) {
      const target = allowLinks ? safeHref(m[3]) : null;
      const label = renderInline(m[2], k, false);
      if (!target) out.push(<React.Fragment key={k}>{label}</React.Fragment>);
      else if (target.internal)
        out.push(
          <Link key={k} href={target.href} className={linkClass}>
            {label}
          </Link>
        );
      else
        out.push(
          <a key={k} href={target.href} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
            {label}
          </a>
        );
    } else if (m[4] != null) {
      out.push(
        <em key={k} className="italic">
          {renderInline(m[4], k, allowLinks)}
        </em>
      );
    } else if (m[5] != null) {
      out.push(
        <code key={k} className="rounded-[6px] bg-[rgba(20,20,20,0.06)] px-1.5 py-0.5 font-mono text-[0.85em]">
          {m[5]}
        </code>
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return (
    <div className={cn("space-y-2.5 break-words", className)}>
      {blocks.map((b, bi) => {
        if (b.kind === "p") {
          return (
            <p key={bi}>
              {b.lines.map((l, li) => (
                <React.Fragment key={li}>
                  {li > 0 && <br />}
                  {renderInline(l, `${bi}.${li}`)}
                </React.Fragment>
              ))}
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={bi} className="space-y-1.5">
              {b.items.map((it, ii) => (
                <li key={ii} className="flex gap-2.5">
                  <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-orza-energy" />
                  <span className="min-w-0">{renderInline(it, `${bi}.${ii}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={bi} start={b.start} className="space-y-1.5">
            {b.items.map((it, ii) => (
              <li key={ii} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.2em] w-4 shrink-0 text-right font-mono text-[12px] text-orza-subtle">
                  {b.start + ii}.
                </span>
                <span className="min-w-0">{renderInline(it, `${bi}.${ii}`)}</span>
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}
