import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GoogleDriveService } from "./drive-service";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("GoogleDriveService", () => {
  it("refreshes OAuth and creates the seminar folder hierarchy", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const responses = [
      jsonResponse({ access_token: "access-token", expires_in: 3600 }),
      jsonResponse({ files: [] }),
      jsonResponse({ id: "root-folder" }),
      jsonResponse({ id: "seminar-folder" }),
      jsonResponse({ id: "session-folder" }),
    ];
    const fetcher: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return response;
    };
    const service = new GoogleDriveService({
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
      fetch: fetcher,
    });

    const seminarFolder = await service.ensureSeminarFolder({
      name: "Death",
      drive_folder_id: null,
    });
    const sessionFolder = await service.ensureSessionFolder(
      {
        session_number: 3,
        title: "Death and the Good Life",
        drive_folder_id: null,
      },
      seminarFolder.folderId,
    );

    assert.equal(seminarFolder.folderId, "seminar-folder");
    assert.equal(sessionFolder.folderId, "session-folder");
    assert.match(requests[1]?.url ?? "", /\/drive\/v3\/files\?q=/);
    assert.deepEqual(JSON.parse(String(requests[2]?.init?.body)), {
      name: "Seminars",
      mimeType: "application/vnd.google-apps.folder",
    });
    assert.deepEqual(JSON.parse(String(requests[4]?.init?.body)), {
      name: "Session 03 — Death and the Good Life",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["seminar-folder"],
    });
    assert.equal(
      requests.filter(({ url }) => url.includes("oauth2.googleapis.com"))
        .length,
      1,
    );
  });

  it("verifies, renames, and reuses stored folder IDs", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const responses = [
      jsonResponse({ access_token: "access-token", expires_in: 3600 }),
      jsonResponse({
        id: "seminar-folder",
        name: "Old seminar name",
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
      }),
      jsonResponse({ id: "seminar-folder" }),
      jsonResponse({
        id: "session-folder",
        name: "Session 03 — Old session title",
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
        parents: ["seminar-folder"],
      }),
      jsonResponse({ id: "session-folder" }),
    ];
    const service = new GoogleDriveService({
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
      fetch: async (input, init) => {
        requests.push({ url: String(input), init });
        return responses.shift() ?? jsonResponse({}, 500);
      },
    });

    const seminarFolder = await service.ensureSeminarFolder({
      name: "Death",
      drive_folder_id: "seminar-folder",
    });
    const sessionFolder = await service.ensureSessionFolder(
      {
        session_number: 3,
        title: "Death and the Good Life",
        drive_folder_id: "session-folder",
      },
      seminarFolder.folderId,
    );

    assert.equal(seminarFolder.folderId, "seminar-folder");
    assert.equal(sessionFolder.folderId, "session-folder");
    assert.deepEqual(
      requests
        .filter(({ init }) => init?.method === "PATCH")
        .map(({ init }) => JSON.parse(String(init?.body))),
      [{ name: "Death" }, { name: "Session 03 — Death and the Good Life" }],
    );
  });

  it("does not update stored folders whose names already match", async () => {
    const requests: { init?: RequestInit }[] = [];
    const responses = [
      jsonResponse({ access_token: "access-token", expires_in: 3600 }),
      jsonResponse({
        id: "seminar-folder",
        name: "Death",
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
      }),
      jsonResponse({
        id: "session-folder",
        name: "Session 03 — Death and the Good Life",
        mimeType: "application/vnd.google-apps.folder",
        trashed: false,
        parents: ["seminar-folder"],
      }),
    ];
    const service = new GoogleDriveService({
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "refresh-token",
      fetch: async (_input, init) => {
        requests.push({ init });
        return responses.shift() ?? jsonResponse({}, 500);
      },
    });

    const seminarFolder = await service.ensureSeminarFolder({
      name: "Death",
      drive_folder_id: "seminar-folder",
    });
    await service.ensureSessionFolder(
      {
        session_number: 3,
        title: "Death and the Good Life",
        drive_folder_id: "session-folder",
      },
      seminarFolder.folderId,
    );

    assert.equal(
      requests.filter(({ init }) => init?.method === "PATCH").length,
      0,
    );
  });

  it("reports missing OAuth configuration only when Drive is used", async () => {
    const service = new GoogleDriveService({});
    await assert.rejects(
      service.ensureSeminarFolder({ name: "Death", drive_folder_id: null }),
      /Google Drive is not configured/,
    );
  });

  it("includes Google's OAuth error code in token refresh failures", async () => {
    const service = new GoogleDriveService({
      clientId: "client-id",
      clientSecret: "wrong-secret",
      refreshToken: "refresh-token",
      fetch: async () =>
        jsonResponse(
          {
            error: "invalid_client",
            error_description: "The OAuth client was not found.",
          },
          401,
        ),
    });

    await assert.rejects(
      service.ensureSeminarFolder({ name: "Death", drive_folder_id: null }),
      /\(401\): invalid_client: The OAuth client was not found/,
    );
  });
});
