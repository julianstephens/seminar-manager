import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";

import db from "@/db";
import {
  createParticipant,
  createSeminar,
  createSeminarParticipant,
  createSession,
  getPublicationRecordsBySession,
  getSessionById,
} from "@/repos";
import { createAuthSession, createUser } from "@/repos/auth";

import { setupApp } from "./server";

const appInstances = new Set<Awaited<ReturnType<typeof setupApp>>>();
const getApp = async () => {
  const app = await setupApp();
  appInstances.add(app);
  return app;
};

afterEach(async () => {
  for (const app of appInstances) {
    await app.close();
  }
  appInstances.clear();
});

after(async () => {
  await db.destroy();
});

describe("setupApp", () => {
  it("returns the API health status without authentication", async () => {
    const app = await getApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });

  it("allows access to the Swagger docs without authentication", async () => {
    const app = await getApp();

    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
    });

    assert.equal(response.statusCode, 200);
  });

  it("registers the scheduler once the app is ready", async () => {
    const app = await getApp();

    await app.ready();

    assert.ok(app.scheduler);
    assert.ok(typeof app.scheduler.addCronJob === "function");
  });

  it("registers the /api routes used by the web client", async () => {
    const app = await getApp();
    const routes = app.printRoutes();

    assert.match(routes, /api\//);
    assert.match(routes, /participants \(GET, HEAD, POST\)/);
    assert.match(routes, /:participant_id \(DELETE, PATCH\)/);
  });

  it("allows a participant to receive multiple resource assignments in one session", async () => {
    const app = await getApp();
    const user = await createUser(db, "admin", "test-password");

    assert.ok(user);

    const sessionToken = await createAuthSession(
      db,
      user.id,
      `assignment-test-${Date.now()}`,
    );

    const seminar = await createSeminar(db, {
      name: `Assignment Test ${Date.now()}`,
      description: "Regression check",
      discord_channel_id: "assignment-test",
    });

    assert.ok(seminar);

    const participant = await createParticipant(db, {
      name: `Assignment Participant ${Date.now()}`,
      discord_user_id: `assignment-participant-${Date.now()}`,
    });

    assert.ok(participant);

    await createSeminarParticipant(db, {
      seminar_id: seminar.id,
      participant_id: participant.id,
    });

    const session = await createSession(db, {
      seminar_id: seminar.id,
      session_number: 1,
      title: "Session 01",
      date: new Date("2030-01-01T10:00:00.000Z"),
    });

    assert.ok(session);

    const firstResourceResponse = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/resources`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
      },
      payload: {
        session_id: session.id,
        name: "Slides",
        url: "https://example.com/slides",
        visibility: "individual",
      },
    });

    const secondResourceResponse = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/resources`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
      },
      payload: {
        session_id: session.id,
        name: "Worksheet",
        url: "https://example.com/worksheet",
        visibility: "individual",
      },
    });

    const firstResource = JSON.parse(firstResourceResponse.body).data;
    const secondResource = JSON.parse(secondResourceResponse.body).data;

    const firstAssignmentResponse = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/assignments`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
      },
      payload: {
        participant_id: participant.id,
        resource_id: firstResource.id,
      },
    });

    const secondAssignmentResponse = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/assignments`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
      },
      payload: {
        participant_id: participant.id,
        resource_id: secondResource.id,
      },
    });

    assert.equal(firstAssignmentResponse.statusCode, 200);
    assert.equal(secondAssignmentResponse.statusCode, 200);

    const assignmentsResponse = await app.inject({
      method: "GET",
      url: `/api/sessions/${session.id}/assignments`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
      },
    });

    assert.equal(assignmentsResponse.statusCode, 200);
    const assignments = JSON.parse(assignmentsResponse.body);
    assert.equal(assignments.length, 2);
  });

  it("creates an updated publication record when a published session is republished after edits", async () => {
    const fakeDiscordService = {
      sendChannelMessage: async () => ({ messageId: "channel-message-id" }),
      sendDirectMessage: async () => ({ messageId: "participant-message-id" }),
      editChannelMessage: async () => undefined,
    };
    const fakeDriveService = {
      ensureSeminarFolder: async () => ({
        folderId: "seminar-folder-id",
        url: "https://drive.google.com/drive/folders/seminar-folder-id",
      }),
      ensureSessionFolder: async () => ({
        folderId: "session-folder-id",
        url: "https://drive.google.com/drive/folders/session-folder-id",
      }),
    };

    const app = await setupApp({
      discordService: fakeDiscordService,
      driveService: fakeDriveService,
    });
    appInstances.add(app);
    const user = await createUser(db, "admin", "test-password");

    assert.ok(user);

    const sessionToken = await createAuthSession(
      db,
      user.id,
      `server-test-${Date.now()}`,
    );

    const seminar = await createSeminar(db, {
      name: `Updated Publish Test ${Date.now()}`,
      description: "Regression check",
      discord_channel_id: "updated-publish-test",
    });

    assert.ok(seminar);

    const participant = await createParticipant(db, {
      name: `Updated Participant ${Date.now()}`,
      discord_user_id: `updated-publish-${Date.now()}`,
    });

    assert.ok(participant);

    await createSeminarParticipant(db, {
      seminar_id: seminar.id,
      participant_id: participant.id,
    });

    const session = await createSession(db, {
      seminar_id: seminar.id,
      session_number: 1,
      title: "Session 01",
      date: new Date("2024-01-01T10:00:00.000Z"),
    });

    assert.ok(session);

    const sharedResource = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/resources`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
      },
      payload: {
        session_id: session.id,
        name: "Seminar overview",
        url: "https://drive.google.com/file/d/overview",
        visibility: "shared",
      },
    });
    assert.equal(sharedResource.statusCode, 200);

    const initialPublish = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/publish`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
        "content-type": "application/json",
      },
      payload: { message_appendix: "Bring your notes." },
    });

    assert.equal(initialPublish.statusCode, 200, initialPublish.body);

    await app.inject({
      method: "PATCH",
      url: `/api/sessions/${session.id}`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
        "content-type": "application/json",
      },
      payload: {
        title: "Session 01 Updated",
        date: "2030-01-02T11:30:00.000Z",
        published_at: null,
      },
    });

    const republish = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/publish`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
      },
    });

    assert.equal(republish.statusCode, 200);
    assert.equal(
      (await getSessionById(db, session.id))?.channel_message_appendix,
      "Bring your notes.",
    );

    const records = await getPublicationRecordsBySession(db, session.id);
    assert.equal(records.length, 4);
    assert.equal(
      records.filter(({ action }) => action === "channel_message").length,
      2,
    );
    assert.ok(records.every(({ status }) => status === "success"));

    const selectiveRepublish = await app.inject({
      method: "POST",
      url: `/api/sessions/${session.id}/publish`,
      headers: {
        authorization: `Bearer ${sessionToken.access_token}`,
        "content-type": "application/json",
      },
      payload: {
        notifications: {
          channel_message: false,
          participant_dms: false,
        },
      },
    });

    assert.equal(selectiveRepublish.statusCode, 200);
    assert.deepEqual(JSON.parse(selectiveRepublish.body).results, {
      drive: "success",
      participant_dms: [],
    });

    const selectiveRecords = await getPublicationRecordsBySession(
      db,
      session.id,
    );
    assert.equal(selectiveRecords.length, 5);
    assert.equal(
      selectiveRecords.filter(({ action }) => action === "drive_setup").length,
      3,
    );
    assert.equal(
      selectiveRecords.filter(({ action }) => action === "channel_message")
        .length,
      2,
    );
  });
});
