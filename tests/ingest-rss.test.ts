import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFeed } from "../src/lib/ingest/rss";

test("decodes numeric HTML entities in feed titles", () => {
  const [item] = parseFeed(`
    <rss>
      <channel>
        <item>
          <title>&amp;#8216;We&amp;#8217;ll care for you&amp;#8217;</title>
          <link>https://example.com/story</link>
          <description>Story text</description>
        </item>
      </channel>
    </rss>
  `);

  assert.equal(item?.title, "‘We’ll care for you’");
});
