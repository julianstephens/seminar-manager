import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionSummary } from "./home-session-summary";

describe("getSessionSummary", () => {
  it("counts only published sessions and picks the earliest upcoming published session", () => {
    const summary = getSessionSummary([
      {
        data: {
          date: "2026-09-10T13:00:00.000Z",
          published_at: "2026-09-10T12:00:00.000Z",
          status: "scheduled",
        },
      },
      {
        data: {
          date: "2026-09-01T10:00:00.000Z",
          published_at: "2026-09-01T09:00:00.000Z",
          status: "scheduled",
        },
      },
      { data: { date: "2026-08-25T09:00:00.000Z", status: "completed" } },
    ]);

    assert.equal(summary.planned, 2);
    assert.equal(summary.nextSessionLabel, "Sep 1, 2026, 10:00 AM");
  });

  it("returns a no-session label when there are no published sessions", () => {
    const summary = getSessionSummary([]);

    assert.equal(summary.planned, 0);
    assert.equal(summary.nextSessionLabel, "Not scheduled");
  });
});
