import * as cheerio from "cheerio";
import type { SourceFetchConfig } from "@/lib/trust/types";
import { htmlToText } from "./clean";
import { ACCEPT_HTML, fetchText } from "./fetch";

export interface HtmlIngestSource {
  id: string;
  url: string;
  fetchConfig: SourceFetchConfig;
}

export interface HtmlItem {
  title: string;
  link: string;
  publishedAt: Date | null;
  text: string;
}

export interface HtmlFetchResult {
  items: HtmlItem[];
  errors: string[];
}

const MAX_ITEMS_DEFAULT = 10;
const MIN_TEXT_LENGTH = 120;
const ITEM_DELAY_MS = 250;

const CONTENT_SELECTORS = [
  "article",
  "main",
  "[role=main]",
  ".entry-content",
  ".post-content",
  ".node__content",
  ".article-content",
  ".news-detail",
  "#content",
  ".content",
];

const DATE_PATTERNS = [
  /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d\d)\b/i,
  /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d\d)\b/i,
  /\b(20\d\d-\d{1,2}-\d{1,2})\b/,
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAsset(url: URL): boolean {
  return /\.(css|js|png|jpe?g|gif|svg|ico|webp|pdf|zip|xml|rss|mp4|mp3|woff2?)(\?|$)/i.test(
    url.pathname,
  );
}

export interface ListingLink {
  url: string;
  title: string;
}

export function parseListing(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  config: SourceFetchConfig,
): ListingLink[] {
  const anchors = config.listSelector
    ? $(config.listSelector).toArray()
    : $("a").toArray();
  const pattern = config.linkPattern
    ? new RegExp(config.linkPattern, "i")
    : null;
  const baseHost = new URL(baseUrl).host;
  const max = config.maxItems ?? MAX_ITEMS_DEFAULT;
  const seen = new Set<string>();
  const out: ListingLink[] = [];

  for (const element of anchors) {
    if (out.length >= max) break;
    const href = $(element).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(href.trim(), baseUrl);
    } catch {
      continue;
    }
    if (url.host !== baseHost || isAsset(url)) continue;
    const target = `${url.pathname}${url.search}`;
    if (pattern && !pattern.test(target)) continue;
    url.hash = "";
    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({
      url: normalized,
      title: $(element).text().replace(/\s+/g, " ").trim(),
    });
  }
  return out;
}

function pickContentHtml($: cheerio.CheerioAPI): string {
  let bestSelector: string | null = null;
  let bestLength = 0;
  for (const selector of CONTENT_SELECTORS) {
    const node = $(selector).first();
    if (node.length === 0) continue;
    const length = node.text().replace(/\s+/g, " ").trim().length;
    if (length > bestLength) {
      bestLength = length;
      bestSelector = selector;
    }
  }
  if (bestSelector !== null && bestLength >= 200) {
    return $(bestSelector).first().html() ?? "";
  }
  return $("body").html() ?? $.html();
}

function cleanTitle(value: string): string {
  const title = value.replace(/\s+/g, " ").trim();
  if (!title || title.length < 8) return "";
  if (
    /^(read more|more|next|previous|share|details|click here)$/i.test(title)
  ) {
    return "";
  }
  return title.slice(0, 300);
}

function extractTitle(
  $: cheerio.CheerioAPI,
  config: SourceFetchConfig,
): string {
  if (config.titleSelector) {
    const node = $(config.titleSelector).first();
    const selected = cleanTitle(node.text() || node.attr("content") || "");
    if (selected) return selected;
  }
  const meta = cleanTitle($('meta[property="og:title"]').attr("content") ?? "");
  if (meta) return meta;
  // Then prefer the first heading in document order; tag priority alone picks
  // footer or section headings that appear later in the page.
  for (const element of $("h1, h2, h3").toArray()) {
    const title = cleanTitle($(element).text());
    if (title) return title;
  }
  const documentTitle = cleanTitle($("title").first().text());
  return documentTitle || "(untitled)";
}

function extractDate(
  $: cheerio.CheerioAPI,
  config: SourceFetchConfig,
  text: string,
): Date | null {
  if (config.dateSelector) {
    const raw = $(config.dateSelector).first().text().trim();
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const meta =
    $('meta[property="article:published_time"]').attr("content") ??
    $("time[datetime]").first().attr("datetime");
  if (meta) {
    const parsed = new Date(meta);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function extractItem(
  $: cheerio.CheerioAPI,
  link: string,
  config: SourceFetchConfig,
  fallbackTitle = "",
): HtmlItem {
  const title = cleanTitle(fallbackTitle) || extractTitle($, config);
  const contentHtml =
    config.contentSelector && $(config.contentSelector).length > 0
      ? ($(config.contentSelector).first().html() ?? "")
      : pickContentHtml($);
  const text = htmlToText(contentHtml);
  return {
    title,
    link,
    publishedAt: extractDate($, config, text),
    text,
  };
}

/**
 * Listing mode follows links from a listing page; snapshot mode (no list
 * selector or link pattern) ingests the page itself as one versioned
 * document, which suits pages like weather-warning bulletins.
 */
export async function fetchHtmlItems(
  source: HtmlIngestSource,
): Promise<HtmlFetchResult> {
  const config = source.fetchConfig ?? {};
  const listingMode = Boolean(config.listSelector || config.linkPattern);
  const listingHtml = await fetchText(source.url, {
    accept: ACCEPT_HTML,
    timeoutMs: config.timeoutMs,
  });
  const $ = cheerio.load(listingHtml);

  if (!listingMode) {
    const item = extractItem($, source.url, config);
    return item.text.length >= MIN_TEXT_LENGTH
      ? { items: [item], errors: [] }
      : { items: [], errors: [] };
  }

  const links = parseListing($, source.url, config);
  const items: HtmlItem[] = [];
  const errors: string[] = [];

  for (const link of links) {
    try {
      const pageHtml = await fetchText(link.url, {
        accept: ACCEPT_HTML,
        timeoutMs: config.timeoutMs,
      });
      const page = cheerio.load(pageHtml);
      const item = extractItem(page, link.url, config, link.title);
      if (item.text.length >= MIN_TEXT_LENGTH) {
        items.push(item);
      }
    } catch (error) {
      errors.push(
        `${link.url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await sleep(ITEM_DELAY_MS);
  }

  return { items, errors };
}
