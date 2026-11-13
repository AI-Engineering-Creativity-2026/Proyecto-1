import * as DOMPurifyModule from "dompurify";
import { marked } from "marked";

const sanitizerModule = DOMPurifyModule.default ?? DOMPurifyModule;
const DOMPurify = (typeof sanitizerModule === "function"
  ? sanitizerModule(globalThis.window)
  : sanitizerModule) as {
  sanitize: (html: string, options: { USE_PROFILES: { html: boolean } }) => string;
};

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
