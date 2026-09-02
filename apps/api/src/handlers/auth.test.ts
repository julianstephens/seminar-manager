import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveLoginAction } from "./auth";

describe("resolveLoginAction", () => {
  it("creates a user and session when no user exists", () => {
    const result = resolveLoginAction({
      user: null,
      passwordHash: "hash",
      clientFingerprint: "fp-1",
      sessions: [],
    });

    assert.equal(result, "create-user-and-session");
  });

  it("rejects a mismatched password", () => {
    const result = resolveLoginAction({
      user: { id: 1, name: "admin", password_hash: "stored-hash" },
      passwordHash: "wrong-hash",
      clientFingerprint: "fp-1",
      sessions: [],
    });

    assert.equal(result, "invalid-password");
  });

  it("revokes and recreates a session for the same client when one already exists", () => {
    const result = resolveLoginAction({
      user: { id: 1, name: "admin", password_hash: "stored-hash" },
      passwordHash: "stored-hash",
      clientFingerprint: "fp-1",
      sessions: [
        { id: "1", user_id: 1, client_fingerprint: "fp-1", status: "active" },
      ],
    });

    assert.equal(result, "revoke-and-create-session");
  });

  it("creates a session when the user matches and there is no existing session for this client", () => {
    const result = resolveLoginAction({
      user: { id: 1, name: "admin", password_hash: "stored-hash" },
      passwordHash: "stored-hash",
      clientFingerprint: "fp-2",
      sessions: [
        { id: "1", user_id: 1, client_fingerprint: "fp-1", status: "active" },
      ],
    });

    assert.equal(result, "create-session");
  });
});
