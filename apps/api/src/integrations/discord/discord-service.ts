import { REST, Routes, type RESTPostAPIChannelMessageResult } from "discord.js";

export type DiscordMessage = { content: string };

export interface DiscordService {
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

const messageBody = ({ content }: DiscordMessage) => {
  if (!content.trim()) throw new Error("Discord messages cannot be empty");
  if (content.length > 2_000)
    throw new Error("Discord messages cannot exceed 2,000 characters");

  return {
    content,
    allowed_mentions: { parse: [] as string[] },
  };
};

export class DiscordJsService implements DiscordService {
  private readonly rest: RestClient;
  private readonly guildId: string;

  constructor(token: string, guildId: string, rest?: RestClient) {
    this.guildId = guildId;
    this.rest = rest ?? new REST({ version: "10" }).setToken(token);
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
    const result = (await this.rest.post(Routes.channelMessages(channelId), {
      body: messageBody(message),
    })) as RESTPostAPIChannelMessageResult;
    return { messageId: result.id };
  }

  async sendDirectMessage(userId: string, message: DiscordMessage) {
    const dm = (await this.rest.post(Routes.userChannels(), {
      body: { recipient_id: userId },
    })) as { id: string };
    const result = (await this.rest.post(Routes.channelMessages(dm.id), {
      body: messageBody(message),
    })) as RESTPostAPIChannelMessageResult;
    return { messageId: result.id };
  }

  async editChannelMessage(
    channelId: string,
    messageId: string,
    message: DiscordMessage,
  ): Promise<void> {
    await this.assertGuildChannel(channelId);
    await this.rest.patch(Routes.channelMessage(channelId, messageId), {
      body: messageBody(message),
    });
  }
}

export const discordErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
