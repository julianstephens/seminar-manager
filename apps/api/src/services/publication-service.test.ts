import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatArchiveMessage,
  formatChannelMessage,
  formatDirectMessage,
  hasSessionAssignment,
} from "./publication-service";

describe("hasSessionAssignment", () => {
  it("rejects a session with no shared or individual assignments", () => {
    assert.equal(hasSessionAssignment([], []), false);
    assert.equal(
      hasSessionAssignment([{ visibility: "individual" }], []),
      false,
    );
  });

  it("accepts a session with only shared assignments", () => {
    assert.equal(hasSessionAssignment([{ visibility: "shared" }], []), true);
  });

  it("accepts a session with only individual assignments", () => {
    assert.equal(
      hasSessionAssignment([{ visibility: "individual" }], [{}]),
      true,
    );
  });

  it("accepts a combination of shared and individual assignments", () => {
    assert.equal(hasSessionAssignment([{ visibility: "shared" }], [{}]), true);
  });
});

describe("Discord publication messages", () => {
  const seminar = {
    id: "seminar-id",
    name: "Death",
    description: null,
    discord_channel_id: "channel-id",
    drive_folder_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const session = {
    id: "session-id",
    seminar_id: seminar.id,
    session_number: 3,
    title: "Death and the Good Life",
    date: new Date("2026-09-18T12:00:00Z"),
    drive_folder_id: "drive-folder",
    channel_message_appendix: null,
    published_at: null,
    archived_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const resource = {
    id: "resource-id",
    session_id: session.id,
    name: "Phaedo",
    url: "https://example.com/phaedo",
    visibility: "shared" as const,
    created_at: new Date(),
    updated_at: new Date(),
  };

  it("formats shared materials for the seminar channel", () => {
    const message = formatChannelMessage(seminar, session, [resource]);
    assert.match(message.content, /Death — Session 3/);
    assert.match(message.content, /September 18, 2026/);
    assert.match(
      message.content,
      /\[Phaedo\]\(https:\/\/example.com\/phaedo\)/,
    );
  });

  it("appends an optional Markdown message to the seminar channel post", () => {
    const message = formatChannelMessage(
      seminar,
      session,
      [resource],
      null,
      "**Please bring:** your notes",
    );

    assert.match(message.content, /\n\n\*\*Please bring:\*\* your notes$/);
  });

  it("formats assigned resources for a participant", () => {
    const message = formatDirectMessage(seminar, session, [resource]);
    assert.match(message.content, /Your reading for this session is/);
    assert.match(message.content, /\[Open reading\]/);
  });

  it("links the Drive folder from an archive message", () => {
    const message = formatArchiveMessage(seminar, session);
    assert.match(
      message.content,
      /https:\/\/drive.google.com\/drive\/folders\/drive-folder/,
    );
  });
});
