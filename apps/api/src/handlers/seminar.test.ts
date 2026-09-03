import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  participantListPayload,
  participantPayload,
  resolveParticipantRecord,
  seminarListPayload,
  seminarPayload,
  sessionListPayload,
  sessionPayload,
} from "./seminar";

describe("seminar response helpers", () => {
  it("wraps a single seminar response payload", () => {
    const result = seminarPayload({
      id: "seminar-1",
      name: "AI Seminar",
      description: "desc",
      discord_channel_id: "channel-1",
      drive_folder_id: "drive-1",
      created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
      updated_at: new Date("2024-01-02T00:00:00Z").toISOString(),
    });

    assert.deepEqual(result, {
      message: "Seminar loaded successfully.",
      data: {
        id: "seminar-1",
        name: "AI Seminar",
        description: "desc",
        discord_channel_id: "channel-1",
        drive_folder_id: "drive-1",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
      },
    });
  });

  it("wraps multiple seminar payloads in a list", () => {
    const result = seminarListPayload([
      {
        id: "seminar-1",
        name: "AI Seminar",
        description: null,
        discord_channel_id: "channel-1",
        drive_folder_id: null,
        created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
        updated_at: new Date("2024-01-02T00:00:00Z").toISOString(),
      },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.message, "Seminar loaded successfully.");
    assert.equal(result[0]?.data.name, "AI Seminar");
  });
});

describe("session response helpers", () => {
  it("wraps a single session response payload", () => {
    const result = sessionPayload({
      id: "session-1",
      seminar_id: "seminar-1",
      session_number: 1,
      title: "Intro",
      date: new Date("2024-02-01T00:00:00Z").toISOString(),
      status: "scheduled",
      drive_folder_id: null,
      published_at: null,
      archived_at: null,
      created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
      updated_at: new Date("2024-01-02T00:00:00Z").toISOString(),
    });

    assert.deepEqual(result, {
      message: "Session loaded successfully.",
      data: {
        id: "session-1",
        seminar_id: "seminar-1",
        session_number: 1,
        title: "Intro",
        date: "2024-02-01T00:00:00.000Z",
        status: "draft",
        drive_folder_id: null,
        published_at: null,
        archived_at: null,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
      },
    });
  });

  it("wraps multiple session payloads in a list", () => {
    const result = sessionListPayload([
      {
        id: "session-1",
        seminar_id: "seminar-1",
        session_number: 1,
        title: "Intro",
        date: new Date("2024-02-01T00:00:00Z").toISOString(),
        status: "scheduled",
        drive_folder_id: null,
        published_at: null,
        archived_at: null,
        created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
        updated_at: new Date("2024-01-02T00:00:00Z").toISOString(),
      },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.message, "Session loaded successfully.");
    assert.equal(result[0]?.data.title, "Intro");
  });
});

describe("participant response helpers", () => {
  it("wraps a single participant response payload", () => {
    const result = participantPayload({
      id: 1,
      name: "Ava",
      discord_user_id: "discord-1",
      created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
      updated_at: new Date("2024-01-02T00:00:00Z").toISOString(),
    });

    assert.deepEqual(result, {
      message: "Participant loaded successfully.",
      data: {
        id: 1,
        name: "Ava",
        discord_user_id: "discord-1",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
      },
    });
  });

  it("wraps multiple participant payloads in a list", () => {
    const result = participantListPayload([
      {
        id: 1,
        name: "Ava",
        discord_user_id: "discord-1",
        created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
        updated_at: new Date("2024-01-02T00:00:00Z").toISOString(),
      },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.message, "Participant loaded successfully.");
    assert.equal(result[0]?.data.name, "Ava");
  });

  it("prefers an exact name match before a Discord match", () => {
    const nameMatch = {
      id: 2,
      name: "Ada Lovelace",
      discord_user_id: "discord-456",
      created_at: "2024-01-03T00:00:00.000Z",
      updated_at: "2024-01-04T00:00:00.000Z",
    };
    const discordMatch = {
      id: 1,
      name: "Ada Lovelace",
      discord_user_id: "discord-123",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
    };

    assert.equal(resolveParticipantRecord(nameMatch, discordMatch), nameMatch);
    assert.equal(resolveParticipantRecord(null, discordMatch), discordMatch);
  });
});
