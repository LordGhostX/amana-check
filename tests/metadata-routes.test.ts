import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { SITE_URL } from "../src/lib/site";

test("robots allows public pages and excludes private routes", () => {
  assert.deepEqual(robots(), {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  });
});

test("sitemap contains only public pages", () => {
  assert.deepEqual(sitemap(), [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/methodology`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/help`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ]);
});
