# Seminar Manager

Administer and manage seminars efficiently with integrated Discord and Google Drive support.

## Discord setup

1. Create an application and bot in the Discord Developer Portal.
2. Add the bot to the seminar server with **View Channels**, **Send Messages**,
   and **Embed Links** permissions. No privileged gateway intents or server
   administration permission are required.
3. Set `DISCORD_BOT_TOKEN` to the bot token and `DISCORD_GUILD_ID` to the ID of
   that server in `.envrc` (or the API process environment).
4. Store the destination channel ID on each seminar and each participant's
   Discord user ID on their participant record.

Publishing posts the shared-resource message to the seminar channel and sends
each participant only their assigned resources. Republishing edits the existing
channel message when possible. Discord failures are stored in the publication
log and can be retried through `POST /api/publications/:id/retry`.

The Discord integration uses REST calls through discord.js 14.27.0 and requires
Node.js 24.17.0 or newer.

## Google Drive setup

1. Enable the Google Drive API in a Google Cloud project and create OAuth 2.0
   credentials.
2. Authorize the administrator's Google account for offline access and store the
   resulting credentials as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   `GOOGLE_REFRESH_TOKEN` in the API environment. The
   `https://www.googleapis.com/auth/drive.file` scope is sufficient for folders
   created or selected through this application.
3. Optionally set `GOOGLE_DRIVE_ROOT_FOLDER_ID` to an existing `Seminars`
   folder. Otherwise the integration finds or creates that folder in My Drive.

Publishing ensures the `Seminars/<seminar>/Session NN — <title>` hierarchy
exists and stores the seminar and session folder IDs in the database. Existing
IDs are verified and reused, and failed Drive setup operations can be retried
from the publication log.
