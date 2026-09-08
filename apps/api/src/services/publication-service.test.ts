import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatArchiveMessage,
  formatChannelMessage,
  formatDirectMessage,
  hasSessionAssignment,
  publishSession,
  retryPublication,
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
    assert.ok(message.content.includes(`<t:1789732800:f>`));
    assert.match(
      message.content,
      /\[Phaedo\]\(https:\/\/example.com\/phaedo\)/,
    );
  });

  for (const date of [
    "2026-09-18T19:00:00-04:00",
    "2026-12-18T19:00:00-05:00",
  ]) {
    it(`preserves 7pm Eastern as a localized Discord timestamp for ${date}`, () => {
      const scheduledDate = new Date(date);
      const message = formatChannelMessage(
        seminar,
        { ...session, date: scheduledDate },
        [],
      );
      const timestamp = message.content.match(/<t:(\d+):f>/)?.[1];
      assert.ok(timestamp, "Expected a native Discord date/time timestamp");
      assert.equal(Number(timestamp) * 1_000, scheduledDate.getTime());
      assert.equal(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(Number(timestamp) * 1_000)),
        "7:00 PM",
      );
    });
  }

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

  it("includes the event link only when an event exists", () => {
    const url = "https://discord.com/events/guild-id/event-id";
    const message = formatChannelMessage(
      seminar,
      session,
      [],
      null,
      undefined,
      url,
    );
    assert.ok(message.content.includes(`[View event](${url})`));
    assert.ok(
      !formatChannelMessage(seminar, session, []).content.includes(
        "[View event]",
      ),
    );
  });

  it("includes Google Calendar and iCal with the session time and shared links", () => {
    const eventUrl = "https://discord.com/events/guild/event";
    const folderUrl = "https://drive.google.com/drive/folders/shared";
    const message = formatChannelMessage(
      seminar,
      session,
      [],
      folderUrl,
      undefined,
      eventUrl,
    );
    const url = new URL(
      message.content.match(/<([^>]+calendar\/render[^>]+)>/)![1]!,
    );
    assert.equal(
      url.searchParams.get("dates"),
      "20260918T120000Z/20260918T130000Z",
    );
    assert.equal(
      url.searchParams.get("text"),
      "Death — Session 3: Death and the Good Life",
    );
    assert.equal(url.searchParams.get("details"), `${eventUrl}\n${folderUrl}`);
    assert.equal(message.calendarFile?.name, "session-3.ics");
    assert.ok(
      message.calendarFile?.content.includes("DTSTART:20260918T120000Z\r\n"),
    );
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

describe("publishing with a Discord event", () => {
  const setup = (failEvent = false) => {
    const session = {
      id: "session",
      seminar_id: "seminar",
      title: "Session title",
      session_number: 1,
      date: new Date("2026-09-18T23:00:00Z"),
      drive_folder_id: "folder",
    };
    const seminar = {
      id: "seminar",
      name: "Seminar name",
      discord_channel_id: "channel",
      drive_folder_id: "folder",
    };
    const records: Record<string, unknown>[] = [];
    const tables: Record<string, Record<string, unknown>[]> = {
      session: [session],
      seminar: [seminar],
      resource: [{ session_id: "session", visibility: "shared" }],
      assignment: [],
      publication_record: records,
    };
    const query = (table: string, insert = false) => {
      let rows = tables[table] ?? [];
      let values: Record<string, unknown> = {};
      const builder = {
        selectAll: () => builder,
        returningAll: () => builder,
        orderBy: () => builder,
        where: (key: string, op: string, value: unknown) => {
          rows = rows.filter((row) =>
            op === "is not" ? row[key] !== value : row[key] === value,
          );
          return builder;
        },
        values: (next: Record<string, unknown>) => {
          values = next;
          return builder;
        },
        set: (next: Record<string, unknown>) => {
          values = next;
          return builder;
        },
        execute: async () => rows,
        executeTakeFirst: async () => {
          if (insert) {
            records.push(values);
            return values;
          }
          rows.forEach((row) => Object.assign(row, values));
          return rows[0];
        },
      };
      return builder;
    };
    const db = {
      selectFrom: query,
      insertInto: (table: string) => query(table, true),
      updateTable: query,
    } as unknown as Parameters<typeof publishSession>[0];
    const messages: string[] = [];
    let shouldFailEvent = failEvent;
    let eventCalls = 0;
    const discord = {
      createScheduledEvent: async (event: {
        name: string;
        location: string;
        startTime: Date;
      }) => {
        eventCalls++;
        assert.deepEqual(event, {
          name: session.title,
          location: seminar.name,
          startTime: session.date,
        });
        if (shouldFailEvent) throw new Error("Missing event permission");
        return { eventId: "event-1" };
      },
      sendChannelMessage: async (
        _channel: string,
        message: { content: string },
      ) => {
        messages.push(message.content);
        return { messageId: "message-1" };
      },
      editChannelMessage: async (
        _channel: string,
        _id: string,
        message: { content: string },
      ) => {
        messages.push(message.content);
      },
      sendDirectMessage: async () => ({ messageId: "dm" }),
    };
    const drive = {
      ensureSeminarFolder: async () => ({
        folderId: "folder",
        url: "https://example.com/folder",
      }),
      ensureSessionFolder: async () => ({
        folderId: "folder",
        url: "https://example.com/folder",
      }),
    };
    const publish = (createEvent = true) =>
      publishSession(db, session.id, discord, drive, undefined, {
        createEvent,
        participantDms: false,
      });
    return {
      publish,
      messages,
      records,
      eventCalls: () => eventCalls,
      retryEvent: async () => {
        shouldFailEvent = false;
        const failed = records.find(
          (record) => record.action === "scheduled_event",
        );
        assert.ok(failed);
        failed.id = 1;
        return retryPublication(db, 1, discord, drive);
      },
    };
  };

  it("creates before sending and reuses the event on republish, retaining its link", async () => {
    const test = setup();
    assert.equal((await test.publish()).results.scheduled_event, "success");
    await test.publish();
    await test.publish(false);
    assert.equal(test.eventCalls(), 1);
    assert.equal(test.messages.length, 3);
    assert.ok(
      test.messages.every((message) =>
        /\[View event\]\(https:\/\/discord.com\/events\/[^/]+\/event-1\)/.test(
          message,
        ),
      ),
    );
  });

  it("adds the event link to the channel post after retrying a failed event", async () => {
    const test = setup(true);
    await test.publish();
    const retried = await test.retryEvent();
    assert.equal(retried?.status, "success");
    assert.equal(test.messages.length, 2);
    assert.ok(test.messages[1]?.includes("/event-1)"));
  });

  it("does not create an event unless selected", async () => {
    const test = setup();
    assert.equal(
      (await test.publish(false)).results.scheduled_event,
      undefined,
    );
    assert.equal(test.eventCalls(), 0);
    assert.ok(!test.messages[0]?.includes("[View event]"));
  });

  it("records event failures while still sending notifications without a broken link", async () => {
    const test = setup(true);
    const result = await test.publish();
    assert.equal(result.results.scheduled_event, "failed");
    assert.equal(result.results.channel_message, "success");
    assert.ok(
      test.records.some(
        (record) =>
          record.action === "scheduled_event" &&
          record.error === "Missing event permission",
      ),
    );
    assert.ok(!test.messages[0]?.includes("[View event]"));
  });
});
