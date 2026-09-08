import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DiscordJsService } from "./discord-service";

type Call = { method: string; route: string; body?: unknown; files?: unknown };

const setup = (channelGuildId = "guild-1") => {
  const calls: Call[] = [];
  const rest = {
    get: async (route: string) => {
      calls.push({ method: "GET", route });
      return { id: "channel-1", guild_id: channelGuildId };
    },
    post: async (
      route: string,
      options?: { body?: unknown; files?: unknown },
    ) => {
      calls.push({
        method: "POST",
        route,
        body: options?.body,
        ...(options?.files ? { files: options.files } : {}),
      });
      if (route.endsWith("/users/@me/channels")) return { id: "dm-1" };
      return { id: "message-1" };
    },
    patch: async (
      route: string,
      options?: { body?: unknown; files?: unknown },
    ) => {
      calls.push({
        method: "PATCH",
        route,
        body: options?.body,
        ...(options?.files ? { files: options.files } : {}),
      });
      return { id: "message-1" };
    },
  };
  const service = new DiscordJsService(
    "token",
    "guild-1",
    rest as unknown as ConstructorParameters<typeof DiscordJsService>[2],
  );
  return { calls, service };
};

describe("DiscordJsService", () => {
  it("validates the guild and sends channel messages without mentions", async () => {
    const { calls, service } = setup();
    const result = await service.sendChannelMessage("channel-1", {
      content: "Seminar materials",
    });

    assert.deepEqual(result, { messageId: "message-1" });
    assert.equal(calls[0]?.method, "GET");
    assert.deepEqual(calls[1]?.body, {
      content: "Seminar materials",
      allowed_mentions: { parse: [] },
    });
  });

  it("rejects a channel from a different guild", async () => {
    const { service } = setup("another-guild");
    await assert.rejects(
      service.sendChannelMessage("channel-1", { content: "Materials" }),
      /not in the configured guild/,
    );
  });

  it("opens a DM channel and sends the direct message", async () => {
    const { calls, service } = setup();
    await service.sendDirectMessage("user-1", { content: "Your reading" });

    assert.deepEqual(calls[0]?.body, { recipient_id: "user-1" });
    assert.equal(calls[1]?.route, "/channels/dm-1/messages");
  });

  it("creates an external event with the session time, title, and seminar location", async () => {
    const { calls, service } = setup();
    assert.deepEqual(
      await service.createScheduledEvent({
        name: "Session title",
        location: "Seminar name",
        startTime: new Date("2026-09-18T19:00:00-04:00"),
      }),
      { eventId: "message-1" },
    );
    assert.deepEqual(calls, [
      {
        method: "POST",
        route: "/guilds/guild-1/scheduled-events",
        body: {
          name: "Session title",
          entity_type: 3,
          privacy_level: 2,
          entity_metadata: { location: "Seminar name" },
          scheduled_start_time: "2026-09-18T23:00:00.000Z",
          scheduled_end_time: "2026-09-19T00:00:00.000Z",
        },
      },
    ]);
  });

  it("edits an existing publication message", async () => {
    const { calls, service } = setup();
    await service.editChannelMessage("channel-1", "message-1", {
      content: "Updated materials",
    });

    assert.equal(calls[1]?.method, "PATCH");
    assert.equal(calls[1]?.route, "/channels/channel-1/messages/message-1");
  });

  it("uploads calendar files and replaces the attachment when editing", async () => {
    const { calls, service } = setup();
    const message = {
      content: "Calendar",
      calendarFile: {
        name: "session-1.ics",
        content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
      },
    };
    await service.sendChannelMessage("channel-1", message);
    await service.editChannelMessage("channel-1", "message-1", message);
    for (const call of [calls[1], calls[3]]) {
      assert.deepEqual(call?.body, {
        content: "Calendar",
        allowed_mentions: { parse: [] },
        attachments: [{ id: "0", filename: "session-1.ics" }],
      });
      assert.deepEqual(call?.files, [
        {
          name: "session-1.ics",
          data: Buffer.from(message.calendarFile.content),
          contentType: "text/calendar; charset=utf-8",
        },
      ]);
    }
  });

  it("rejects empty and oversized messages before sending", async () => {
    const { service } = setup();
    await assert.rejects(
      service.sendDirectMessage("user-1", { content: "" }),
      /cannot be empty/,
    );
    await assert.rejects(
      service.sendDirectMessage("user-1", { content: "x".repeat(2_001) }),
      /2,000 characters/,
    );
  });
});
