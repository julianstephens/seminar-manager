import { expect, test, type Page, type Route } from "@playwright/test";

const seminarId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const now = "2026-09-03T16:00:00.000Z";

const seminar = {
  id: seminarId,
  name: "Ethics Seminar",
  description: "Weekly discussion",
  discord_channel_id: "123456789",
  drive_folder_id: null,
  created_at: now,
  updated_at: now,
};

const session = {
  id: sessionId,
  seminar_id: seminarId,
  session_number: 1,
  title: "Responsibility",
  date: "2026-09-10T18:00:00.000Z",
  status: "ready",
  drive_folder_id: null,
  published_at: null,
  archived_at: null,
  created_at: now,
  updated_at: now,
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const authenticate = async (page: Page) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("seminar-manager:access-token", "test-token");
  });
};

const mockDashboard = async (page: Page, seminars = [{ data: seminar }]) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/seminars") return json(route, seminars);
    if (url.pathname.endsWith("/sessions")) return json(route, []);
    if (route.request().method() === "DELETE") {
      return json(route, { message: "Deleted", data: null });
    }
    return json(route, {});
  });
};

const mockSessionEditor = async (
  page: Page,
  options: {
    failAutosave?: boolean;
    onPublish?: (payload: unknown) => void;
  } = {},
) => {
  let publishedAt: string | null = session.published_at;

  await page.route("**/api/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === `/api/seminars/${seminarId}`) {
      return json(route, { data: seminar });
    }
    if (url.pathname === `/api/sessions/${sessionId}` && method === "GET") {
      return json(route, {
        data: {
          ...session,
          published_at: publishedAt,
          status: publishedAt ? "published" : session.status,
        },
      });
    }
    if (url.pathname === `/api/sessions/${sessionId}` && method === "PATCH") {
      if (options.failAutosave) {
        return json(route, { message: "Network save failed" }, 500);
      }
      const updates = request.postDataJSON();
      return json(route, { data: { ...session, ...updates, updated_at: now } });
    }
    if (url.pathname === `/api/seminars/${seminarId}/participants`) {
      return json(route, []);
    }
    if (url.pathname === `/api/sessions/${sessionId}/resources`) {
      return json(route, [
        {
          data: {
            id: "33333333-3333-4333-8333-333333333333",
            session_id: sessionId,
            name: "Reading",
            url: "https://example.com/reading",
            visibility: "shared",
            created_at: now,
            updated_at: now,
          },
        },
      ]);
    }
    if (url.pathname === `/api/sessions/${sessionId}/assignments`) {
      return json(route, []);
    }
    if (url.pathname === `/api/sessions/${sessionId}/readiness`) {
      return json(route, { ready: true, issues: [] });
    }
    if (url.pathname === "/api/publication-records") return json(route, []);
    if (url.pathname === `/api/sessions/${sessionId}/publish`) {
      options.onPublish?.(request.postDataJSON());
      publishedAt = now;
      return json(route, {
        session_id: sessionId,
        status: "published",
        readiness: { ready: true, issues: [] },
        results: {
          drive: "success",
          channel_message: "success",
          participant_dms: [],
        },
      });
    }
    return json(route, {});
  });
};

test("logs in and reaches the dashboard", async ({ page }) => {
  await mockDashboard(page, []);
  await page.route("**/api/auth/login", (route) =>
    json(route, { access_token: "test-token", expires_in: 3600 }),
  );

  await page.goto("/");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Enter portal" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("mobile navigation opens and reaches settings", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboard(page, []);
  await page.route("**/api/integrations/status", (route) =>
    json(route, {
      checked_at: now,
      discord: {
        status: "connected",
        label: "Test Guild",
        message: "Verified",
      },
      google_drive: { status: "not_configured", message: "Not configured" },
    }),
  );

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("requires confirmation before deleting a seminar", async ({ page }) => {
  await authenticate(page);
  await mockDashboard(page);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Ethics Seminar");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel" })
    .filter({ hasText: "Cancel" })
    .click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
});

test("edits all seminar details together", async ({ page }) => {
  await authenticate(page);
  let savedPayload: Record<string, unknown> | undefined;

  await page.route("**/api/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === `/api/seminars/${seminarId}`) {
      if (request.method() === "PATCH") {
        savedPayload = request.postDataJSON() as Record<string, unknown>;
        return json(route, { data: { ...seminar, ...savedPayload } });
      }
      return json(route, { data: seminar });
    }
    if (url.pathname === `/api/seminars/${seminarId}/participants`) {
      return json(route, []);
    }
    if (url.pathname === `/api/seminars/${seminarId}/sessions`) {
      return json(route, []);
    }
    if (url.pathname === "/api/participants") return json(route, []);
    return json(route, {});
  });

  await page.goto(`/seminars/${seminarId}`);
  await page.getByRole("button", { name: "Edit seminar" }).click();
  await page.getByLabel("Seminar name").fill("Applied Ethics");
  await page.getByLabel("Description").fill("");
  await page.getByLabel("Discord channel ID").fill("987654321");
  await page.getByLabel("Google Drive folder ID").fill("drive-folder-42");
  await page.getByRole("button", { name: "Save all details" }).click();

  await expect
    .poll(() => savedPayload)
    .toEqual({
      name: "Applied Ethics",
      description: null,
      discord_channel_id: "987654321",
      drive_folder_id: "drive-folder-42",
    });
  await expect(
    page.getByRole("heading", { name: "Applied Ethics" }),
  ).toBeVisible();
  await expect(page.getByText("No description provided.")).toBeVisible();
  await expect(page.getByText("Discord channel: 987654321")).toBeVisible();
});

test("shows autosave failure and retry recovery", async ({ page }) => {
  await authenticate(page);
  await mockSessionEditor(page, { failAutosave: true });
  await page.goto(`/seminars/${seminarId}/sessions/${sessionId}`);

  await page.getByLabel("Session title").fill("Updated responsibility");
  await expect(page.getByText("Changes not saved")).toBeVisible({
    timeout: 6_000,
  });
  await expect(page.getByRole("button", { name: "Retry save" })).toBeVisible();
});

test("confirms and publishes a ready session", async ({ page }) => {
  let published = false;
  await authenticate(page);
  await mockSessionEditor(page, { onPublish: () => (published = true) });
  await page.goto(`/seminars/${seminarId}/sessions/${sessionId}`);

  await page.getByRole("button", { name: "Publish Session" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Choose which notifications to send now",
  );
  await page.getByRole("button", { name: "Publish session" }).click();
  await expect.poll(() => published).toBe(true);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Unable to load session editor" }),
  ).toHaveCount(0);
  await expect(page.getByText("Published:")).toBeVisible();
});

test("publishes only the selected notifications", async ({ page }) => {
  let publishPayload: unknown;
  await authenticate(page);
  await mockSessionEditor(page, {
    onPublish: (payload) => (publishPayload = payload),
  });
  await page.goto(`/seminars/${seminarId}/sessions/${sessionId}`);

  await page.getByRole("button", { name: "Publish Session" }).click();
  await page.getByLabel("Individual assignment messages").uncheck();
  await page.getByRole("button", { name: "Publish session" }).click();

  await expect
    .poll(() => publishPayload)
    .toEqual({
      message_appendix: "",
      notifications: {
        channel_message: true,
        participant_dms: false,
      },
    });
});
