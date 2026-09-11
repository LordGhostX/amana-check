import { htmlToInlineText } from "./clean";
import { ACCEPT_JSON, fetchText } from "./fetch";

export interface WordPressItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  html: string;
}

interface WordPressPost {
  date?: unknown;
  date_gmt?: unknown;
  link?: unknown;
  title?: { rendered?: unknown };
  content?: { rendered?: unknown };
  excerpt?: { rendered?: unknown };
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function dateOf(value: unknown): Date | null {
  const raw = stringOf(value);
  if (!raw) return null;
  const hasTimezone = /(?:Z|[+-]\d\d:?\d\d)$/.test(raw);
  const date = new Date(hasTimezone ? raw : `${raw}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseWordPressPosts(json: string): WordPressItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("WordPress API returned invalid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("WordPress API returned an unexpected response");
  }

  return parsed.flatMap((value): WordPressItem[] => {
    if (!value || typeof value !== "object") return [];
    const post = value as WordPressPost;
    const link = stringOf(post.link);
    if (!link) return [];
    const title =
      htmlToInlineText(stringOf(post.title?.rendered)) || "(untitled)";
    const html =
      stringOf(post.content?.rendered) || stringOf(post.excerpt?.rendered);
    return [
      {
        title,
        link,
        publishedAt: dateOf(post.date_gmt) ?? dateOf(post.date),
        html,
      },
    ];
  });
}

export async function fetchWordPressPosts(
  url: string,
  timeoutMs = 20_000,
  maxItems = 10,
): Promise<WordPressItem[]> {
  const endpoint = new URL(url);
  if (!endpoint.searchParams.has("per_page")) {
    endpoint.searchParams.set("per_page", String(Math.min(maxItems, 100)));
  }
  const json = await fetchText(endpoint.toString(), {
    accept: ACCEPT_JSON,
    timeoutMs,
  });
  return parseWordPressPosts(json).slice(0, maxItems);
}
