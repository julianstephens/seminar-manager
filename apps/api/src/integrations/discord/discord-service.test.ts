import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DiscordJsService } from "./discord-service";

type Call = { method: string; route: string; body?: unknown };

const setup = (channelGuildId = "guild-1") => {
  const calls: Call[] = [];
  const rest = {
    get: async (route: string) => {
      calls.push({ method: "GET", route });
      return { id: "channel-1", guild_id: channelGuildId };
    },
    post: async (route: string, options?: { body?: unknown }) => {
      calls.push({ method: "POST", route, body: options?.body });
      if (route.endsWith("/users/@me/channels")) return { id: "dm-1" };
      return { id: "message-1" };
    },
    patch: async (route: string, options?: { body?: unknown }) => {
      calls.push({ method: "PATCH", route, body: options?.body });
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

  it("edits an existing publication message", async () => {
    const { calls, service } = setup();
    await service.editChannelMessage("channel-1", "message-1", {
      content: "Updated materials",
    });

    assert.equal(calls[1]?.method, "PATCH");
    assert.equal(calls[1]?.route, "/channels/channel-1/messages/message-1");
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
