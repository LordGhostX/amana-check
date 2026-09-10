import { XMLParser } from "fast-xml-parser";
import { ACCEPT_XML, fetchText } from "./fetch";

export interface FeedItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  html: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["#text"] === "string") return record["#text"];
  }
  return "";
}

function linkOf(value: unknown): string {
  if (typeof value === "string") return value;
  const entries = asArray(
    value as Record<string, unknown> | Record<string, unknown>[],
  );
  for (const entry of entries) {
    if (entry && typeof entry === "object") {
      const rel = entry["@_rel"];
      if (rel == null || rel === "alternate") {
        const href = entry["@_href"];
        if (typeof href === "string") return href;
      }
    }
  }
  return textOf(value);
}

function dateOf(value: unknown): Date | null {
  const raw = textOf(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const feed = doc.feed as Record<string, unknown> | undefined;
  const rawItems = asArray(channel?.item ?? feed?.entry);
  const items: FeedItem[] = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const title = textOf(item.title) || "(untitled)";
    const link = linkOf(item.link) || textOf(item.guid) || textOf(item.id);
    if (!link) continue;
    const publishedAt = dateOf(
      item.pubDate ?? item.published ?? item.updated ?? item["dc:date"],
    );
    const html =
      textOf(item["content:encoded"]) ||
      textOf(item.content) ||
      textOf(item.description) ||
      textOf(item.summary);
    items.push({ title, link, publishedAt, html });
  }

  return items;
}

export async function fetchFeed(
  url: string,
  timeoutMs = 20_000,
): Promise<FeedItem[]> {
  const xml = await fetchText(url, { accept: ACCEPT_XML, timeoutMs });
  return parseFeed(xml);
}
