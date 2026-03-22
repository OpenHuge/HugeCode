import Prism, { type Grammar } from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-css";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-yaml";

export { languageFromPath } from "./syntaxLanguage";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightLine(text: string, language?: string | null) {
  if (!language || !(Prism.languages as Record<string, unknown>)[language]) {
    return escapeHtml(text);
  }
  return Prism.highlight(text, Prism.languages[language] as Grammar, language);
}

export function highlightCode(text: string, language?: string | null) {
  return highlightLine(text, language);
}

export type HighlightSegment = {
  text: string;
  className?: string;
};

function appendSegment(segments: HighlightSegment[], segment: HighlightSegment) {
  const previous = segments[segments.length - 1];
  if (previous && previous.className === segment.className) {
    previous.text += segment.text;
    return;
  }
  segments.push(segment);
}

function flattenPrismToken(
  token: unknown,
  parentClasses: string[],
  segments: HighlightSegment[]
): void {
  if (typeof token === "string") {
    appendSegment(segments, {
      text: token,
      className: parentClasses.length > 0 ? parentClasses.join(" ") : undefined,
    });
    return;
  }

  if (Array.isArray(token)) {
    token.forEach((item) => {
      flattenPrismToken(item, parentClasses, segments);
    });
    return;
  }

  if (token && typeof token === "object" && "content" in token) {
    const prismToken = token as { type?: unknown; alias?: unknown; content: unknown };
    const nextClasses = [...parentClasses];
    if (typeof prismToken.type === "string" && prismToken.type.length > 0) {
      nextClasses.push("token", prismToken.type);
    }
    if (typeof prismToken.alias === "string" && prismToken.alias.length > 0) {
      nextClasses.push(prismToken.alias);
    } else if (Array.isArray(prismToken.alias)) {
      prismToken.alias.forEach((alias) => {
        if (typeof alias === "string" && alias.length > 0) {
          nextClasses.push(alias);
        }
      });
    }
    flattenPrismToken(prismToken.content, nextClasses, segments);
    return;
  }

  if (token != null) {
    appendSegment(segments, {
      text: String(token),
      className: parentClasses.length > 0 ? parentClasses.join(" ") : undefined,
    });
  }
}

export function highlightLineSegments(text: string, language?: string | null): HighlightSegment[] {
  if (!language || !(Prism.languages as Record<string, unknown>)[language]) {
    return [{ text }];
  }

  const grammar = Prism.languages[language] as Grammar | undefined;
  if (!grammar) {
    return [{ text }];
  }

  const tokens = Prism.tokenize(text, grammar) as unknown;
  const segments: HighlightSegment[] = [];
  flattenPrismToken(tokens, [], segments);
  return segments.length > 0 ? segments : [{ text }];
}
