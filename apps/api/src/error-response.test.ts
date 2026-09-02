import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toStandardErrorResponse } from "./error-response";

describe("toStandardErrorResponse", () => {
  it("returns the shared error contract", () => {
    assert.deepEqual(
      toStandardErrorResponse(401, "Invalid session", { method: "POST" }),
      {
        status_code: 401,
        success: false,
        message: "Invalid session",
        details: {
          method: "POST",
        },
      },
    );
  });

  it("omits details when none are provided", () => {
    assert.deepEqual(toStandardErrorResponse(400, "Bad request"), {
      status_code: 400,
      success: false,
      message: "Bad request",
    });
  });
});
