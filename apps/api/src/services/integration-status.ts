import { env } from "@/env";
import {
  DiscordJsService,
  discordErrorMessage,
} from "@/integrations/discord/discord-service";
import {
  GoogleDriveService,
  driveErrorMessage,
} from "@/integrations/google-drive/drive-service";

export type IntegrationStatus = {
  status: "connected" | "error" | "not_configured";
  label?: string;
  message: string;
};

export type IntegrationStatusResponse = {
  checked_at: string;
  discord: IntegrationStatus;
  google_drive: IntegrationStatus;
};

const discord = new DiscordJsService(
  env.DISCORD_BOT_TOKEN,
  env.DISCORD_GUILD_ID,
);
const drive = new GoogleDriveService({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  refreshToken: env.GOOGLE_REFRESH_TOKEN,
  rootFolderId: env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
});

export const getIntegrationStatus =
  async (): Promise<IntegrationStatusResponse> => {
    const driveConfigured = Boolean(
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REFRESH_TOKEN,
    );

    const [discordResult, driveResult] = await Promise.allSettled([
      discord.checkConnection(),
      driveConfigured ? drive.checkConnection() : Promise.resolve(null),
    ]);

    return {
      checked_at: new Date().toISOString(),
      discord:
        discordResult.status === "fulfilled"
          ? {
              status: "connected",
              label: discordResult.value.label,
              message: "Bot credentials and guild access verified.",
            }
          : {
              status: "error",
              message: discordErrorMessage(discordResult.reason),
            },
      google_drive: !driveConfigured
        ? {
            status: "not_configured",
            message: "Google Drive OAuth credentials are not configured.",
          }
        : driveResult.status === "fulfilled" && driveResult.value
          ? {
              status: "connected",
              label: driveResult.value.label,
              message: "OAuth credentials and Drive access verified.",
            }
          : {
              status: "error",
              message: driveErrorMessage(
                driveResult.status === "rejected"
                  ? driveResult.reason
                  : "Unable to verify Google Drive.",
              ),
            },
    };
  };
