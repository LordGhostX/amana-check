import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWordPressPosts } from "../src/lib/ingest/wordpress";

test("parses WordPress posts into ingest items", () => {
  const [item] = parseWordPressPosts(
    JSON.stringify([
      {
        date: "2026-09-10T23:47:25",
        date_gmt: "2026-09-10T22:47:25",
        link: "https://example.com/story",
        title: { rendered: "Flood &amp; safety" },
        content: { rendered: "<p>Residents should move to safe ground.</p>" },
      },
    ]),
  );

  assert.equal(item?.title, "Flood & safety");
  assert.equal(item?.link, "https://example.com/story");
  assert.equal(item?.html, "<p>Residents should move to safe ground.</p>");
  assert.equal(item?.publishedAt?.toISOString(), "2026-09-10T22:47:25.000Z");
});

test("rejects a Cloudflare HTML challenge instead of treating it as a feed", () => {
  assert.throws(
    () => parseWordPressPosts("<html><body>challenge</body></html>"),
    /invalid JSON/,
  );
});

test("keeps an explicit WordPress timezone intact", () => {
  const [item] = parseWordPressPosts(
    JSON.stringify([
      {
        date: "2026-09-10T23:47:25+01:00",
        link: "https://example.com/story",
        title: { rendered: "Timezone test" },
      },
    ]),
  );

  assert.equal(item?.publishedAt?.toISOString(), "2026-09-10T22:47:25.000Z");
});
