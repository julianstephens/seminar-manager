import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDbCleanerWorkerData } from "./db-cleaner.ts";

describe("buildDbCleanerWorkerData", () => {
  it("returns only structured-clone safe values", () => {
    const data = buildDbCleanerWorkerData("postgres://example.db");

    assert.deepEqual(data, { databaseUrl: "postgres://example.db" });
    assert.doesNotThrow(() => structuredClone(data));
  });
});
