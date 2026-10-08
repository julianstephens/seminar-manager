import { REST, Routes, type RESTPostAPIChannelMessageResult } from "discord.js";

export type DiscordMessage = {
  content: string;
  calendarFile?: { name: string; content: string };
};

export type DiscordEvent = { name: string; location: string; startTime: Date };

export const discordEventUrl = (guildId: string, eventId: string) =>
  `https://discord.com/events/${guildId}/${eventId}`;

export interface DiscordService {
  createScheduledEvent(event: DiscordEvent): Promise<{ eventId: string }>;
  updateScheduledEvent(eventId: string, event: DiscordEvent): Promise<void>;
  sendChannelMessage(
    channelId: string,
    message: DiscordMessage,
  ): Promise<{ messageId: string }>;
  sendDirectMessage(
    userId: string,
    message: DiscordMessage,
  ): Promise<{ messageId: string }>;
  editChannelMessage(
    channelId: string,
    messageId: string,
    message: DiscordMessage,
  ): Promise<void>;
}

type RestClient = Pick<REST, "get" | "post" | "patch">;

const messageBody = ({ content, calendarFile }: DiscordMessage) => {
  if (!content.trim()) throw new Error("Discord messages cannot be empty");
  if (content.length > 2_000)
    throw new Error("Discord messages cannot exceed 2,000 characters");

  return {
    content,
    allowed_mentions: { parse: [] as string[] },
    ...(calendarFile
      ? { attachments: [{ id: "0", filename: calendarFile.name }] }
      : {}),
  };
};

const messageOptions = (message: DiscordMessage) => ({
  body: messageBody(message),
  ...(message.calendarFile
    ? {
        files: [
          {
            name: message.calendarFile.name,
            data: Buffer.from(message.calendarFile.content, "utf8"),
            contentType: "text/calendar; charset=utf-8",
          },
        ],
      }
    : {}),
});

export class DiscordJsService implements DiscordService {
  private readonly rest: RestClient;
  private readonly guildId: string;

  constructor(token: string, guildId: string, rest?: RestClient) {
    this.guildId = guildId;
    this.rest = rest ?? new REST({ version: "10" }).setToken(token);
  }

  async createScheduledEvent(
    event: DiscordEvent,
  ): Promise<{ eventId: string }> {
    const result = (await this.rest.post(
      Routes.guildScheduledEvents(this.guildId),
      {
        body: {
          name: event.name,
          entity_type: 3,
          privacy_level: 2,
          entity_metadata: { location: event.location },
          scheduled_start_time: event.startTime.toISOString(),
          scheduled_end_time: new Date(
            event.startTime.getTime() + 60 * 60 * 1_000,
          ).toISOString(),
        },
      },
    )) as { id: string };
    return { eventId: result.id };
  }

  async updateScheduledEvent(
    eventId: string,
    event: DiscordEvent,
  ): Promise<void> {
    await this.rest.patch(Routes.guildScheduledEvent(this.guildId, eventId), {
      body: {
        name: event.name,
        entity_type: 3,
        privacy_level: 2,
        entity_metadata: { location: event.location },
        scheduled_start_time: event.startTime.toISOString(),
        scheduled_end_time: new Date(
          event.startTime.getTime() + 60 * 60 * 1_000,
        ).toISOString(),
      },
    });
  }

  async checkConnection(): Promise<{ label: string }> {
    const guild = (await this.rest.get(Routes.guild(this.guildId))) as {
      name?: string;
    };
    return { label: guild.name?.trim() || `Guild ${this.guildId}` };
  }

  private async assertGuildChannel(channelId: string): Promise<void> {
    const channel = (await this.rest.get(Routes.channel(channelId))) as {
      guild_id?: string;
    };

    if (channel.guild_id !== this.guildId) {
      throw new Error(
        "The configured Discord channel is not in the configured guild",
      );
    }
  }

  async sendChannelMessage(channelId: string, message: DiscordMessage) {
    await this.assertGuildChannel(channelId);
    const result = (await this.rest.post(
      Routes.channelMessages(channelId),
      messageOptions(message),
    )) as RESTPostAPIChannelMessageResult;
    return { messageId: result.id };
  }

  async sendDirectMessage(userId: string, message: DiscordMessage) {
    const dm = (await this.rest.post(Routes.userChannels(), {
      body: { recipient_id: userId },
    })) as { id: string };
    const result = (await this.rest.post(
      Routes.channelMessages(dm.id),
      messageOptions(message),
    )) as RESTPostAPIChannelMessageResult;
    return { messageId: result.id };
  }

  async editChannelMessage(
    channelId: string,
    messageId: string,
    message: DiscordMessage,
  ): Promise<void> {
    await this.assertGuildChannel(channelId);
    await this.rest.patch(
      Routes.channelMessage(channelId, messageId),
      messageOptions(message),
    );
  }
}

export const discordErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
