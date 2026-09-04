import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getReadinessActionSpec } from "./session-readiness";

describe("getReadinessActionSpec", () => {
  it("returns title focus action for title requirement", () => {
    const action = getReadinessActionSpec(
      "A session title is required before publishing.",
      false,
    );

    assert.equal(action.kind, "focus-title");
    assert.equal(action.label, "Add title");
  });

  it("returns view seminar action for Discord channel issues", () => {
    const action = getReadinessActionSpec(
      "Discord channel is not configured for this seminar.",
      false,
    );

    assert.equal(action.kind, "view-seminar");
    assert.equal(action.label, "View seminar");
  });

  it("returns add resource for assignment requirement when no resources exist", () => {
    const action = getReadinessActionSpec(
      "At least one assignment is required before publishing.",
      false,
    );

    assert.equal(action.kind, "add-resource");
    assert.equal(action.label, "Add resource");
  });

  it("returns add assignment for assignment requirement when resources exist", () => {
    const action = getReadinessActionSpec(
      "At least one assignment is required before publishing.",
      true,
    );

    assert.equal(action.kind, "add-assignment");
    assert.equal(action.label, "Add assignment");
  });

  it("extracts a resource name for URL issues", () => {
    const action = getReadinessActionSpec(
      "Resource “Reading list” needs a URL.",
      true,
    );

    assert.equal(action.kind, "edit-resource-url");
    assert.equal(action.label, "Add URL");
    assert.equal(action.resourceName, "Reading list");
  });

  it("falls back to review resources when name cannot be parsed", () => {
    const action = getReadinessActionSpec("Resource needs a URL.", true);

    assert.equal(action.kind, "review-resources");
    assert.equal(action.label, "Review resources");
  });

  it("falls back to review assignments for unknown issues", () => {
    const action = getReadinessActionSpec("Unknown warning", true);

    assert.equal(action.kind, "review-assignments");
    assert.equal(action.label, "Review assignments");
  });
});
