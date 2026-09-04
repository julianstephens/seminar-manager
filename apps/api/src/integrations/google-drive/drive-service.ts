const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export type DriveFolder = { folderId: string; url: string };

export interface DriveService {
  ensureSeminarFolder(seminar: {
    name: string;
    drive_folder_id: string | null;
  }): Promise<DriveFolder>;
  ensureSessionFolder(
    session: {
      session_number: number;
      title: string;
      drive_folder_id: string | null;
    },
    seminarFolderId: string,
  ): Promise<DriveFolder>;
}

type GoogleDriveServiceOptions = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  rootFolderId?: string;
  fetch?: typeof fetch;
};

type DriveFile = {
  id: string;
  mimeType?: string;
  trashed?: boolean;
  parents?: string[];
};

const folderUrl = (folderId: string) =>
  `https://drive.google.com/drive/folders/${folderId}`;

export class GoogleDriveService implements DriveService {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly refreshToken?: string;
  private readonly rootFolderId?: string;
  private readonly fetcher: typeof fetch;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(options: GoogleDriveServiceOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshToken = options.refreshToken;
    this.rootFolderId = options.rootFolderId;
    this.fetcher = options.fetch ?? fetch;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000) {
      return this.accessToken.value;
    }
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error(
        "Google Drive is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.",
      );
    }

    const response = await this.fetcher(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !payload.access_token) {
      const reason = [payload.error, payload.error_description]
        .filter(Boolean)
        .join(": ");
      throw new Error(
        `Google OAuth token refresh failed (${response.status}): ${reason || response.statusText}`,
      );
    }

    this.accessToken = {
      value: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3_600) * 1_000,
    };
    return payload.access_token;
  }

  private async driveRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const response = await this.fetcher(`${DRIVE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(
        `Google Drive request failed: ${payload?.error?.message ?? response.statusText}`,
      );
    }
    return (await response.json()) as T;
  }

  async checkConnection(): Promise<{ label: string }> {
    const about = await this.driveRequest<{
      user?: { displayName?: string; emailAddress?: string };
    }>("/about?fields=user(displayName,emailAddress)");
    return {
      label:
        about.user?.emailAddress?.trim() ||
        about.user?.displayName?.trim() ||
        "Google Drive",
    };
  }

  private async verifyFolder(folderId: string, parentId?: string) {
    const file = await this.driveRequest<DriveFile>(
      `/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed,parents&supportsAllDrives=true`,
    );
    if (file.trashed || file.mimeType !== FOLDER_MIME_TYPE) {
      throw new Error(`Google Drive item ${folderId} is not an active folder`);
    }
    if (parentId && !file.parents?.includes(parentId)) {
      throw new Error(
        `Google Drive folder ${folderId} is outside its expected parent`,
      );
    }
    return { folderId: file.id, url: folderUrl(file.id) };
  }

  private async createFolder(name: string, parentId?: string) {
    const file = await this.driveRequest<DriveFile>(
      "/files?fields=id&supportsAllDrives=true",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          mimeType: FOLDER_MIME_TYPE,
          ...(parentId ? { parents: [parentId] } : {}),
        }),
      },
    );
    if (!file.id) throw new Error("Google Drive did not return a folder ID");
    return { folderId: file.id, url: folderUrl(file.id) };
  }

  private async ensureApplicationRoot(): Promise<DriveFolder> {
    if (this.rootFolderId) return await this.verifyFolder(this.rootFolderId);
    const query = [
      "'root' in parents",
      "name = 'Seminars'",
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      "trashed = false",
    ].join(" and ");
    const result = await this.driveRequest<{ files?: DriveFile[] }>(
      `/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&spaces=drive`,
    );
    const existing = result.files?.[0];
    if (existing) {
      return { folderId: existing.id, url: folderUrl(existing.id) };
    }
    return await this.createFolder("Seminars");
  }

  async ensureSeminarFolder(seminar: {
    name: string;
    drive_folder_id: string | null;
  }): Promise<DriveFolder> {
    if (seminar.drive_folder_id) {
      return await this.verifyFolder(seminar.drive_folder_id);
    }
    const root = await this.ensureApplicationRoot();
    return await this.createFolder(seminar.name, root.folderId);
  }

  async ensureSessionFolder(
    session: {
      session_number: number;
      title: string;
      drive_folder_id: string | null;
    },
    seminarFolderId: string,
  ): Promise<DriveFolder> {
    if (session.drive_folder_id) {
      return await this.verifyFolder(session.drive_folder_id, seminarFolderId);
    }
    const number = String(session.session_number).padStart(2, "0");
    return await this.createFolder(
      `Session ${number} — ${session.title}`,
      seminarFolderId,
    );
  }
}

export const driveErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
