import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { XMLParser } from "fast-xml-parser";
import { optionalEnv } from "@/lib/env";

export interface FeedItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  html: string;
}

const execFileAsync = promisify(execFile);

const USER_AGENT =
  "AmanaCheck/0.1 (+https://amana-check.vercel.app; ingestion)";
const ACCEPT =
  "application/rss+xml, application/atom+xml, application/xml, text/xml, */*";

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

/**
 * ReliefWeb and some other publishers answer non-browser HTTP clients with
 * `202` empty bodies or `406` bot-block pages while allowing curl. We keep
 * the honest AmanaCheck user agent and retry once through curl (fixed
 * argument array, no shell) before treating the source as failed.
 */
function isBotBlock(status: number, body: string): boolean {
  if (status === 202 || status === 406) return true;
  return /blocked due to bot activity/i.test(body);
}

async function fetchXmlWithCurl(
  url: string,
  timeoutMs: number,
): Promise<string> {
  if (optionalEnv("INGEST_CURL_FALLBACK") === "0") {
    throw new Error("curl fallback is disabled by INGEST_CURL_FALLBACK");
  }
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sSL",
        "--max-time",
        String(Math.ceil(timeoutMs / 1000)),
        "-A",
        USER_AGENT,
        "-H",
        `Accept: ${ACCEPT}`,
        url,
      ],
      { maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs + 5000 },
    );
    if (!stdout.trim()) {
      throw new Error("curl returned an empty body");
    }
    return stdout;
  } catch (error) {
    throw new Error(
      `curl fallback failed (${error instanceof Error ? error.message : String(error)}). Install curl or set INGEST_CURL_FALLBACK=0 to fail fast.`,
    );
  }
}

export async function fetchFeed(
  url: string,
  timeoutMs = 20_000,
): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: ACCEPT },
    });
    const body = await response.text().catch(() => "");

    if (isBotBlock(response.status, body)) {
      const xml = await fetchXmlWithCurl(url, timeoutMs);
      return parseFeed(xml);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return parseFeed(body);
  } finally {
    clearTimeout(timer);
  }
}
