import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchHtmlItems } from "../src/lib/ingest/html";

const baseUrl = "https://example.test";
const articleText =
  "NEMA issued a flood preparedness update for communities near the river. ".repeat(
    12,
  );

function articlePage(title: string): string {
  return `<main><h1>${title}</h1><time datetime="2026-09-10T00:00:00Z"></time><p>${articleText}</p></main>`;
}

function listingPage(): string {
  return `<a class="story" href="/article/one">First flood update</a><a class="story" href="/article/two">Second flood update</a>`;
}

test("streams each listing item before fetching the next article", async () => {
  const originalFetch = globalThis.fetch;
  const events: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    events.push(`fetch:${url}`);
    if (url === `${baseUrl}/listing`) {
      return new Response(listingPage());
    }
    if (url === `${baseUrl}/article/one`) {
      return new Response(articlePage("First flood update"));
    }
    if (url === `${baseUrl}/article/two`) {
      return new Response(articlePage("Second flood update"));
    }
    return new Response("missing", { status: 404 });
  };

  try {
    const result = await fetchHtmlItems(
      {
        id: "fixture",
        url: `${baseUrl}/listing`,
        fetchConfig: {
          listSelector: "a.story",
          linkPattern: "^/article/",
          maxItems: 2,
        },
      },
      async (item) => {
        events.push(`write:${item.link}`);
      },
    );

    assert.deepEqual(result, { errors: [], itemsFound: 2 });
    assert.deepEqual(events, [
      `fetch:${baseUrl}/listing`,
      `fetch:${baseUrl}/article/one`,
      `write:${baseUrl}/article/one`,
      `fetch:${baseUrl}/article/two`,
      `write:${baseUrl}/article/two`,
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports a handler error while continuing the listing stream", async () => {
  const originalFetch = globalThis.fetch;
  const writes: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === `${baseUrl}/listing`) return new Response(listingPage());
    return new Response(articlePage(url.endsWith("/one") ? "First" : "Second"));
  };

  try {
    const result = await fetchHtmlItems(
      {
        id: "fixture",
        url: `${baseUrl}/listing`,
        fetchConfig: {
          listSelector: "a.story",
          linkPattern: "^/article/",
          maxItems: 2,
        },
      },
      async (item) => {
        writes.push(item.link);
        if (item.link.endsWith("/one")) throw new Error("write failed");
      },
    );

    assert.equal(result.itemsFound, 2);
    assert.deepEqual(writes, [
      `${baseUrl}/article/one`,
      `${baseUrl}/article/two`,
    ]);
    assert.deepEqual(result.errors, [`${baseUrl}/article/one: write failed`]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
