import { marked } from 'marked';

// Publishes report markdown as a Telegraph page (nice Instant-View link) instead
// of a raw .md file. Telegraph content is a JSON tree of Nodes; it supports a
// limited tag set (no tables — those are rendered as monospace <pre> grids).

const API = 'https://api.telegra.ph';

type TelegraphNode = string | { tag: string; attrs?: Record<string, string>; children?: TelegraphNode[] };

/* eslint-disable @typescript-eslint/no-explicit-any */

function accessToken(): string {
  const t = process.env.TELEGRAPH_ACCESS_TOKEN;
  if (!t) throw new Error('TELEGRAPH_ACCESS_TOKEN is not set');
  return t;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ',
};
function decode(s: string): string {
  return (s ?? '').replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

/** Recursively flatten inline tokens to plain text (used for table cells). */
function plainText(tokens: any[] | undefined): string {
  if (!tokens) return '';
  return tokens
    .map((t) => (t.tokens ? plainText(t.tokens) : decode(t.text ?? t.raw ?? '')))
    .join('');
}

function inline(tokens: any[] | undefined): TelegraphNode[] {
  if (!tokens) return [];
  const out: TelegraphNode[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'text':
        if (t.tokens?.length) out.push(...inline(t.tokens));
        else out.push(decode(t.text));
        break;
      case 'strong':
        out.push({ tag: 'strong', children: inline(t.tokens) });
        break;
      case 'em':
        out.push({ tag: 'em', children: inline(t.tokens) });
        break;
      case 'del':
        out.push({ tag: 's', children: inline(t.tokens) });
        break;
      case 'codespan':
        out.push({ tag: 'code', children: [decode(t.text)] });
        break;
      case 'link':
        out.push({ tag: 'a', attrs: { href: t.href }, children: inline(t.tokens) });
        break;
      case 'br':
        out.push({ tag: 'br' });
        break;
      case 'escape':
        out.push(decode(t.text));
        break;
      case 'html':
        out.push(decode(t.text.replace(/<[^>]*>/g, '')));
        break;
      default:
        if (t.text) out.push(decode(t.text));
    }
  }
  return out;
}

/** Telegraph has no table tag; render as an aligned monospace grid in <pre>. */
function tableNode(t: any): TelegraphNode {
  const header: string[] = t.header.map((c: any) => plainText(c.tokens));
  const rows: string[][] = t.rows.map((r: any[]) => r.map((c) => plainText(c.tokens)));
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const pad = (s: string, i: number) => s + ' '.repeat(Math.max(0, widths[i] - s.length));
  const line = (cells: string[]) => cells.map(pad).join('  ').trimEnd();
  const sep = widths.map((w) => '─'.repeat(w)).join('  ');
  const text = [line(header), sep, ...rows.map(line)].join('\n');
  return { tag: 'pre', children: [text] };
}

function listItem(item: any): TelegraphNode {
  const children: TelegraphNode[] = [];
  for (const t of item.tokens ?? []) {
    if (t.type === 'text') children.push(...inline(t.tokens ?? [{ type: 'text', text: t.text }]));
    else children.push(...blocks([t]));
  }
  return { tag: 'li', children };
}

function blocks(tokens: any[]): TelegraphNode[] {
  const out: TelegraphNode[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'heading':
        out.push({ tag: t.depth <= 2 ? 'h3' : 'h4', children: inline(t.tokens) });
        break;
      case 'paragraph':
        out.push({ tag: 'p', children: inline(t.tokens) });
        break;
      case 'text':
        out.push({ tag: 'p', children: t.tokens ? inline(t.tokens) : [decode(t.text)] });
        break;
      case 'blockquote':
        out.push({ tag: 'blockquote', children: blocks(t.tokens) });
        break;
      case 'list':
        out.push({
          tag: t.ordered ? 'ol' : 'ul',
          children: t.items.map(listItem),
        });
        break;
      case 'code':
        out.push({ tag: 'pre', children: [t.text] });
        break;
      case 'table':
        out.push(tableNode(t));
        break;
      case 'hr':
        out.push({ tag: 'hr' });
        break;
      case 'space':
        break;
      case 'html': {
        const s = decode(t.text.replace(/<[^>]*>/g, '')).trim();
        if (s) out.push({ tag: 'p', children: [s] });
        break;
      }
      default:
        if (t.tokens) out.push({ tag: 'p', children: inline(t.tokens) });
        else if (t.text) out.push({ tag: 'p', children: [decode(t.text)] });
    }
  }
  return out;
}

/** First H1 text, used as the page title (kept out of the body to avoid dupes). */
export function firstHeading(md: string): string | null {
  const m = md.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m);
  return m ? m[1].trim() : null;
}

export function markdownToNodes(md: string): TelegraphNode[] {
  const tokens = marked.lexer(md) as any[];
  const first = tokens.findIndex((t) => t.type !== 'space');
  if (first >= 0 && tokens[first].type === 'heading' && tokens[first].depth === 1) {
    tokens.splice(first, 1);
  }
  return blocks(tokens);
}

export async function publishTelegraph(opts: {
  title: string;
  markdown: string;
  authorName?: string;
  authorUrl?: string;
}): Promise<string> {
  const content = markdownToNodes(opts.markdown);
  const res = await fetch(`${API}/createPage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken(),
      title: (opts.title || 'Analysis').slice(0, 256),
      author_name: opts.authorName?.slice(0, 128),
      author_url: opts.authorUrl,
      content,
      return_content: false,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`telegraph createPage failed: ${data.error}`);
  return data.result.url as string;
}
