import * as DOMPurifyModule from "dompurify";
import { marked } from "marked";

interface Sanitizer {
  sanitize: (html: string, options: { USE_PROFILES: { html: boolean } }) => string;
}

const sanitizer = DOMPurifyModule.default as unknown as Partial<Sanitizer>;

function sanitizeWithoutDom(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "");
}

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false });

  return sanitizer.sanitize
    ? sanitizer.sanitize(html, { USE_PROFILES: { html: true } })
    : sanitizeWithoutDom(html);
}
