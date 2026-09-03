import type { Database } from "db";
import type { Kysely } from "kysely";
import {
  DiscordJsService,
  discordErrorMessage,
  type DiscordService,
} from "@/integrations/discord/discord-service";
import { env } from "@/env";

import {
  createPublicationRecord,
  getAssignmentsBySession,
  getParticipantById,
  getResourcesBySession,
  getSeminarById,
  getSessionById,
  updatePublicationRecord,
  updateSession,
} from "@/repos";
import { ApiError } from "@/handlers";

export type SessionLifecycle = "draft" | "ready" | "published" | "archived";
export type PublicationAction =
  "channel_message" | "participant_dm" | "drive_setup" | "archive_message";

export type Readiness = { ready: boolean; issues: string[] };
export type PublicationResult = {
  session_id: string;
  status: "published" | "archived";
  readiness: Readiness;
  results: {
    drive: "success" | "failed";
    channel_message?: "success" | "failed";
    archive_message?: "success" | "failed";
    participant_dms: { participant_id: number; status: "success" | "failed" }[];
  };
};

type SessionDetails = Awaited<ReturnType<typeof getSessionById>> & {};
type SeminarDetails = NonNullable<Awaited<ReturnType<typeof getSeminarById>>>;
type ResourceDetails = Awaited<
  ReturnType<typeof getResourcesBySession>
>[number];

export const formatChannelMessage = (
  seminar: SeminarDetails,
  session: NonNullable<SessionDetails>,
  resources: ResourceDetails[],
): { content: string } => {
  const shared = resources.filter(({ visibility }) => visibility === "shared");
  const materials = shared.length
    ? shared.map(({ name, url }) => `- [${name}](${url})`).join("\n")
    : "- No shared materials";
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(session.date);

  return {
    content: [
      `**${seminar.name} — Session ${session.session_number}**`,
      `**${session.title}**`,
      date,
      "**Materials**",
      materials,
      "Please complete your assigned reading before the seminar.",
    ].join("\n\n"),
  };
};

export const formatDirectMessage = (
  seminar: SeminarDetails,
  session: NonNullable<SessionDetails>,
  resources: ResourceDetails[],
): { content: string } => ({
  content: [
    `**${seminar.name} — Session ${session.session_number}**`,
    "Your reading for this session is:",
    ...resources.map(({ name, url }) => `**${name}**\n[Open reading](${url})`),
  ].join("\n\n"),
});

export const formatArchiveMessage = (
  seminar: SeminarDetails,
  session: NonNullable<SessionDetails>,
): { content: string } => ({
  content: [
    `**${seminar.name} — Session ${session.session_number}**`,
    "Session materials and resources are now archived here:",
    session.drive_folder_id
      ? `[Session archive](https://drive.google.com/drive/folders/${session.drive_folder_id})`
      : "The session archive is available from Seminar Admin.",
  ].join("\n\n"),
});

export const hasSessionAssignment = (
  resources: { visibility: "shared" | "individual" }[],
  assignments: unknown[],
): boolean =>
  resources.some((resource) => resource.visibility === "shared") ||
  assignments.length > 0;

// Drive remains a deterministic adapter until its integration is configured.
const driveIntegration = {
  ensureDriveFolder: async () => ({
    status: "success" as const,
    externalId: null,
  }),
};

const discord = new DiscordJsService(
  env.DISCORD_BOT_TOKEN,
  env.DISCORD_GUILD_ID,
);

const runDiscordOperation = async (
  operation: () => Promise<{ messageId: string } | void>,
): Promise<{
  status: "success" | "failed";
  externalId: string | null;
  error: string | null;
}> => {
  try {
    const result = await operation();
    return {
      status: "success",
      externalId: result?.messageId ?? null,
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      externalId: null,
      error: discordErrorMessage(error),
    };
  }
};

const record = async (
  db: Kysely<Database>,
  sessionId: string,
  action: PublicationAction,
  status: "success" | "failed",
  participantId: number | null = null,
  externalId: string | null = null,
  error: string | null = null,
) =>
  await createPublicationRecord(db, {
    session_id: sessionId,
    action,
    participant_id: participantId,
    external_id: externalId,
    status,
    error,
  });

export const getReadiness = async (
  db: Kysely<Database>,
  session: { id: string; seminar_id: string; title: string },
): Promise<Readiness> => {
  const issues: string[] = [];
  const seminar = await getSeminarById(db, session.seminar_id);
  const resources = await getResourcesBySession(db, session.id);
  const assignments = await getAssignmentsBySession(db, session.id);

  if (!session.title.trim()) issues.push("A session title is required.");
  if (!seminar?.discord_channel_id.trim())
    issues.push("The seminar needs a Discord channel.");
  if (!hasSessionAssignment(resources, assignments)) {
    issues.push("At least one shared or individual assignment is required.");
  }

  for (const assignment of assignments) {
    const participant = await getParticipantById(db, assignment.participant_id);
    const resource = resources.find(
      (item) => item.id === assignment.resource_id,
    );
    if (!participant)
      issues.push(`Assignment ${assignment.id} has no valid participant.`);
    if (!resource)
      issues.push(`Assignment ${assignment.id} has no valid session resource.`);
    else if (!resource.url.trim()) {
      issues.push(`Resource “${resource.name}” needs a URL.`);
    }
  }
  return { ready: issues.length === 0, issues };
};

export const getSessionLifecycle = async (
  db: Kysely<Database>,
  session: {
    id: string;
    seminar_id: string;
    title: string;
    published_at: Date | null;
    archived_at: Date | null;
  },
): Promise<SessionLifecycle> => {
  if (session.archived_at) return "archived";
  if (session.published_at) return "published";
  return (await getReadiness(db, session)).ready ? "ready" : "draft";
};

export const publishSession = async (
  db: Kysely<Database>,
  sessionId: string,
  discordService: DiscordService = discord,
): Promise<PublicationResult> => {
  const session = await getSessionById(db, sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  const readiness = await getReadiness(db, session);
  if (!readiness.ready)
    throw new ApiError(400, "Session is not ready to publish", { readiness });

  const seminar = await getSeminarById(db, session.seminar_id);
  if (!seminar) throw new ApiError(404, "Seminar not found");
  const resources = await getResourcesBySession(db, session.id);
  const drive = await driveIntegration.ensureDriveFolder();
  await record(
    db,
    session.id,
    "drive_setup",
    drive.status,
    null,
    drive.externalId,
  );
  const priorChannelMessage = await db
    .selectFrom("publication_record")
    .selectAll()
    .where("session_id", "=", session.id)
    .where("action", "=", "channel_message")
    .where("status", "=", "success")
    .where("external_id", "is not", null)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  const channel = await runDiscordOperation(async () => {
    const message = formatChannelMessage(seminar, session, resources);
    if (priorChannelMessage?.external_id) {
      await discordService.editChannelMessage(
        seminar.discord_channel_id,
        priorChannelMessage.external_id,
        message,
      );
      return { messageId: priorChannelMessage.external_id };
    }
    return await discordService.sendChannelMessage(
      seminar.discord_channel_id,
      message,
    );
  });
  await record(
    db,
    session.id,
    "channel_message",
    channel.status,
    null,
    channel.externalId,
    channel.error,
  );

  const assignments = await getAssignmentsBySession(db, session.id);
  const participantIds = [
    ...new Set(assignments.map(({ participant_id }) => participant_id)),
  ];
  const participant_dms = await Promise.all(
    participantIds.map(async (participant_id) => {
      const participant = await getParticipantById(db, participant_id);
      const assignedResourceIds = assignments
        .filter((assignment) => assignment.participant_id === participant_id)
        .map((assignment) => assignment.resource_id);
      const assignedResources = resources.filter((resource) =>
        assignedResourceIds.includes(resource.id),
      );
      const dm = participant
        ? await runDiscordOperation(() =>
            discordService.sendDirectMessage(
              participant.discord_user_id,
              formatDirectMessage(seminar, session, assignedResources),
            ),
          )
        : {
            status: "failed" as const,
            externalId: null,
            error: "Participant not found",
          };
      await record(
        db,
        session.id,
        "participant_dm",
        dm.status,
        participant_id,
        dm.externalId,
        dm.error,
      );
      return { participant_id, status: dm.status };
    }),
  );

  await updateSession(db, session.id, { published_at: new Date() });
  return {
    session_id: session.id,
    status: "published",
    readiness,
    results: {
      drive: drive.status,
      channel_message: channel.status,
      participant_dms,
    },
  };
};

export const archiveSession = async (
  db: Kysely<Database>,
  sessionId: string,
  discordService: DiscordService = discord,
): Promise<PublicationResult> => {
  const session = await getSessionById(db, sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  const readiness = await getReadiness(db, session);
  const seminar = await getSeminarById(db, session.seminar_id);
  if (!seminar) throw new ApiError(404, "Seminar not found");
  const drive = await driveIntegration.ensureDriveFolder();
  await record(
    db,
    session.id,
    "drive_setup",
    drive.status,
    null,
    drive.externalId,
  );
  const archive = await runDiscordOperation(() =>
    discordService.sendChannelMessage(
      seminar.discord_channel_id,
      formatArchiveMessage(seminar, session),
    ),
  );
  await record(
    db,
    session.id,
    "archive_message",
    archive.status,
    null,
    archive.externalId,
    archive.error,
  );
  await updateSession(db, session.id, { archived_at: new Date() });
  return {
    session_id: session.id,
    status: "archived",
    readiness,
    results: {
      drive: drive.status,
      archive_message: archive.status,
      participant_dms: [],
    },
  };
};

export const retryPublication = async (
  db: Kysely<Database>,
  recordId: number,
  discordService: DiscordService = discord,
) => {
  const existing = await db
    .selectFrom("publication_record")
    .selectAll()
    .where("id", "=", recordId)
    .executeTakeFirst();
  if (!existing) throw new ApiError(404, "Publication record not found");
  if (existing.status === "success")
    throw new ApiError(400, "Only failed publication records can be retried");
  const session = await getSessionById(db, existing.session_id);
  if (!session) throw new ApiError(404, "Session not found");
  const seminar = await getSeminarById(db, session.seminar_id);
  if (!seminar) throw new ApiError(404, "Seminar not found");
  const resources = await getResourcesBySession(db, session.id);
  let result: Awaited<ReturnType<typeof runDiscordOperation>>;

  if (existing.action === "channel_message") {
    result = await runDiscordOperation(() =>
      discordService.sendChannelMessage(
        seminar.discord_channel_id,
        formatChannelMessage(seminar, session, resources),
      ),
    );
  } else if (existing.action === "archive_message") {
    result = await runDiscordOperation(() =>
      discordService.sendChannelMessage(
        seminar.discord_channel_id,
        formatArchiveMessage(seminar, session),
      ),
    );
  } else if (existing.action === "participant_dm" && existing.participant_id) {
    const participant = await getParticipantById(db, existing.participant_id);
    if (!participant) throw new ApiError(404, "Participant not found");
    const assignments = await getAssignmentsBySession(db, session.id);
    const assignedIds = assignments
      .filter(({ participant_id }) => participant_id === participant.id)
      .map(({ resource_id }) => resource_id);
    result = await runDiscordOperation(() =>
      discordService.sendDirectMessage(
        participant.discord_user_id,
        formatDirectMessage(
          seminar,
          session,
          resources.filter(({ id }) => assignedIds.includes(id)),
        ),
      ),
    );
  } else {
    throw new ApiError(400, "This publication action cannot be retried yet");
  }

  const updated = await updatePublicationRecord(db, recordId, {
    status: result.status,
    external_id: result.externalId,
    error: result.error,
  });
  return updated;
};
