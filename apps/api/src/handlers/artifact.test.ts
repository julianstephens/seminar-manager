import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assignmentPayload,
  publicationRecordPayload,
  resourcePayload,
} from "./artifact";

describe("artifact response helpers", () => {
  it("wraps a single resource response payload", () => {
    const result = resourcePayload({
      id: "resource-1",
      session_id: "session-1",
      name: "Slides",
      url: "https://example.com/slides",
      visibility: "individual",
      created_at: new Date("2024-01-01T00:00:00Z"),
      updated_at: new Date("2024-01-02T00:00:00Z"),
    });

    assert.deepEqual(result, {
      message: "Resource loaded successfully.",
      data: {
        id: "resource-1",
        session_id: "session-1",
        name: "Slides",
        url: "https://example.com/slides",
        visibility: "individual",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
      },
    });
  });

  it("wraps a single assignment response payload", () => {
    const result = assignmentPayload({
      id: "assignment-1",
      session_id: "session-1",
      participant_id: 7,
      resource_id: "resource-1",
      created_at: new Date("2024-01-01T00:00:00Z"),
    });

    assert.deepEqual(result, {
      message: "Assignment loaded successfully.",
      data: {
        id: "assignment-1",
        session_id: "session-1",
        participant_id: 7,
        resource_id: "resource-1",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    });
  });

  it("wraps a single publication record response payload", () => {
    const result = publicationRecordPayload({
      id: 3,
      session_id: "session-1",
      action: "channel_message",
      participant_id: null,
      external_id: null,
      status: "success",
      error: null,
      created_at: new Date("2024-01-01T00:00:00Z"),
    });

    assert.deepEqual(result, {
      message: "Publication record loaded successfully.",
      data: {
        id: 3,
        session_id: "session-1",
        action: "channel_message",
        participant_id: null,
        external_id: null,
        status: "success",
        error: null,
        created_at: "2024-01-01T00:00:00.000Z",
      },
    });
  });
});
