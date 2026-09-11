import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessEvidence,
  HOUR_MS,
  REQUIREMENTS,
} from "../src/lib/trust/freshness";

const NOW = new Date("2026-09-11T12:00:00.000Z");

function evidenceFromHoursAgo(hours: number) {
  return [
    {
      tier: 1,
      publisher: "Official source",
      publishedAt: new Date(NOW.getTime() - hours * HOUR_MS),
      fetchedAt: NOW,
    },
  ];
}

test("security evidence stays fresh for four hours", () => {
  assert.equal(REQUIREMENTS.security_incident.windowMs, 4 * HOUR_MS);
  assert.equal(
    assessEvidence("security_incident", evidenceFromHoursAgo(4), null, NOW)
      .status,
    "verified",
  );
  assert.equal(
    assessEvidence(
      "security_incident",
      evidenceFromHoursAgo(4 + 1 / 3_600_000),
      null,
      NOW,
    ).status,
    "not_confirmed_stale",
  );
});

test("flood and weather evidence stays fresh for twelve hours", () => {
  assert.equal(REQUIREMENTS.flood_weather.windowMs, 12 * HOUR_MS);
  assert.equal(
    assessEvidence("flood_weather", evidenceFromHoursAgo(12), null, NOW).status,
    "verified",
  );
  assert.equal(
    assessEvidence(
      "flood_weather",
      evidenceFromHoursAgo(12 + 1 / 3_600_000),
      null,
      NOW,
    ).status,
    "not_confirmed_stale",
  );
});
