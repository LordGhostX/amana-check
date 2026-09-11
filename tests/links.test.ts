import assert from "node:assert/strict";
import { test } from "node:test";
import { UTM_SOURCE, withUtmSource } from "../src/lib/links";
import { SITE_URL } from "../src/lib/site";

test("uses the site host without its protocol as the UTM source", () => {
  assert.equal(UTM_SOURCE, new URL(SITE_URL).host);
});

test("adds the Amana source to HTTP links while preserving URL parts", () => {
  const expected = new URL("https://example.com/article?topic=flood#sources");
  expected.searchParams.set("utm_source", UTM_SOURCE);

  assert.equal(
    withUtmSource("https://example.com/article?topic=flood#sources"),
    expected.toString(),
  );
});

test("replaces an existing source parameter", () => {
  const expected = new URL("https://example.com/");
  expected.searchParams.set("utm_source", UTM_SOURCE);

  assert.equal(
    withUtmSource("https://example.com/?utm_source=other"),
    expected.toString(),
  );
});

test("leaves non-HTTP and invalid links unchanged", () => {
  assert.equal(withUtmSource("tel:+234112233"), "tel:+234112233");
  assert.equal(withUtmSource("not a URL"), "not a URL");
});
