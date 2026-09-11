import assert from "node:assert/strict";
import { test } from "node:test";
import { isCronAuthorized } from "../src/lib/cron/auth";

async function withEnvironment<T>(
  values: Record<string, string | undefined>,
  work: () => T | Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  try {
    return await work();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function headers(value?: string): Headers {
  return value ? new Headers({ authorization: value }) : new Headers();
}

test("rejects missing, blank, and production-template cron secrets", async () => {
  await withEnvironment(
    { CRON_SECRET: undefined, NODE_ENV: "production" },
    () => assert.equal(isCronAuthorized(headers("Bearer replace-me")), false),
  );
  await withEnvironment({ CRON_SECRET: "   ", NODE_ENV: "production" }, () =>
    assert.equal(isCronAuthorized(headers("Bearer replace-me")), false),
  );
  await withEnvironment(
    { CRON_SECRET: "replace-me", NODE_ENV: "production" },
    () => assert.equal(isCronAuthorized(headers("Bearer replace-me")), false),
  );
});

test("accepts the configured secret and rejects other authorization headers", async () => {
  await withEnvironment(
    { CRON_SECRET: "a-long-random-cron-secret", NODE_ENV: "production" },
    () => {
      assert.equal(
        isCronAuthorized(headers("Bearer a-long-random-cron-secret")),
        true,
      );
      assert.equal(isCronAuthorized(headers("Bearer wrong-secret")), false);
      assert.equal(isCronAuthorized(headers()), false);
    },
  );
});

test("allows the template secret only outside production", async () => {
  await withEnvironment(
    { CRON_SECRET: "replace-me", NODE_ENV: "development" },
    () => assert.equal(isCronAuthorized(headers("Bearer replace-me")), true),
  );
});
