# Seminar Manager

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
