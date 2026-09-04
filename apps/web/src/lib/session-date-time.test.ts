import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fromDateTimeInputValue,
  toDateTimeInputValue,
} from "./session-date-time.ts";

describe("session date helpers", () => {
  it("round-trips a local datetime while keeping UTC storage semantics", () => {
    const value = "2025-06-13T19:00";
    const iso = fromDateTimeInputValue(value);

    assert.ok(iso, "expected a valid ISO timestamp");
    assert.equal(toDateTimeInputValue(iso!), value);
  });
});
