import db from "@/db";
import {
  createParticipant,
  createSeminar,
  createSeminarParticipant,
  createSession,
  deleteSeminar,
  deleteSeminarParticipant,
  deleteSession,
  getParticipantByDiscordUserId,
  getParticipantById,
  getParticipantByName,
  getParticipants,
  getSeminarById,
  getSeminarByName,
  getSeminarParticipantByPair,
  getSeminarParticipants,
  getSeminars,
  getSessionById,
  getSessionBySeminarAndNumber,
  getSessionsBySeminar,
  updateParticipant,
  updateSeminar,
  updateSession,
} from "@/repos";
import type {
  Participant,
  ParticipantCreate,
  ParticipantResponse,
  ParticipantUpdate,
  Seminar,
  SeminarCreate,
  SeminarResponse,
  SeminarUpdate,
  Session,
  SessionCreate,
  SessionResponse,
  SessionUpdate,
} from "schemas";

import { serializeApiDates } from "./format";
import { ApiError } from "./index";

export const seminarPayload = <T extends Record<string, unknown>>(
  seminar: T,
): SeminarResponse => ({
  message: "Seminar loaded successfully.",
  data: serializeApiDates(seminar) as unknown as Seminar,
});

export const seminarListPayload = <T extends Record<string, unknown>>(
  seminars: T[],
): SeminarResponse[] =>
  seminars.map((seminar) => ({
    message: "Seminar loaded successfully.",
    data: serializeApiDates(seminar) as unknown as Seminar,
  }));

export const sessionPayload = <T extends Record<string, unknown>>(
  session: T,
): SessionResponse => ({
  message: "Session loaded successfully.",
  data: serializeApiDates(session) as unknown as Session,
});

export const sessionListPayload = <T extends Record<string, unknown>>(
  sessions: T[],
): SessionResponse[] =>
  sessions.map((session) => ({
    message: "Session loaded successfully.",
    data: serializeApiDates(session) as unknown as Session,
  }));

export const getSeminarsHandler = async (): Promise<SeminarResponse[]> => {
  const seminars = await getSeminars(db);
  return seminarListPayload(seminars);
};

export const getSeminarHandler = async (
  seminarId: string,
): Promise<SeminarResponse> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  return seminarPayload(seminar);
};

export const createSeminarHandler = async (
  body: SeminarCreate,
): Promise<SeminarResponse> => {
  const existingSeminar = await getSeminarByName(db, body.name);

  if (existingSeminar) {
    throw new ApiError(409, "Seminar with that name already exists");
  }

  const seminar = await createSeminar(db, body);

  if (!seminar) {
    throw new ApiError(500, "Unable to create seminar");
  }

  return seminarPayload(seminar);
};

export const updateSeminarHandler = async (
  seminarId: string,
  body: SeminarUpdate,
): Promise<SeminarResponse> => {
  const existingSeminar = await getSeminarById(db, seminarId);

  if (!existingSeminar) {
    throw new ApiError(404, "Seminar not found");
  }

  if (body.name && body.name !== existingSeminar.name) {
    const duplicate = await getSeminarByName(db, body.name);
    if (duplicate) {
      throw new ApiError(409, "Seminar with that name already exists");
    }
  }

  const seminar = await updateSeminar(db, seminarId, body);

  if (!seminar) {
    throw new ApiError(500, "Unable to update seminar");
  }

  return seminarPayload(seminar);
};

export const deleteSeminarHandler = async (
  seminarId: string,
): Promise<{ message: string; data: null }> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  await deleteSeminar(db, seminarId);

  return { message: "Seminar deleted successfully.", data: null };
};

export const getSessionsHandler = async (
  seminarId: string,
): Promise<SessionResponse[]> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const sessions = await getSessionsBySeminar(db, seminarId);
  return sessionListPayload(sessions);
};

export const getSessionHandler = async (
  seminarId: string,
  sessionId: string,
): Promise<SessionResponse> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const session = await getSessionById(db, sessionId);

  if (!session || session.seminar_id !== seminarId) {
    throw new ApiError(404, "Session not found");
  }

  return sessionPayload(session);
};

export const createSessionHandler = async (
  seminarId: string,
  body: SessionCreate,
): Promise<SessionResponse> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const existingSession = await getSessionBySeminarAndNumber(
    db,
    seminarId,
    body.session_number,
  );

  if (existingSession) {
    throw new ApiError(409, "Session number already exists for this seminar");
  }

  const session = await createSession(db, {
    ...body,
    seminar_id: seminarId,
    date: new Date(body.date),
    published_at: body.published_at ? new Date(body.published_at) : null,
    archived_at: body.archived_at ? new Date(body.archived_at) : null,
    status: body.status ?? "scheduled",
  });

  if (!session) {
    throw new ApiError(500, "Unable to create session");
  }

  return sessionPayload(session);
};

export const updateSessionHandler = async (
  seminarId: string,
  sessionId: string,
  body: SessionUpdate,
): Promise<SessionResponse> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const existingSession = await getSessionById(db, sessionId);

  if (!existingSession || existingSession.seminar_id !== seminarId) {
    throw new ApiError(404, "Session not found");
  }

  if (
    body.session_number &&
    body.session_number !== existingSession.session_number
  ) {
    const duplicate = await getSessionBySeminarAndNumber(
      db,
      seminarId,
      body.session_number,
    );

    if (duplicate && duplicate.id !== sessionId) {
      throw new ApiError(409, "Session number already exists for this seminar");
    }
  }

  const session = await updateSession(db, sessionId, {
    ...body,
    date: body.date ? new Date(body.date) : undefined,
    published_at:
      body.published_at === null
        ? null
        : body.published_at
          ? new Date(body.published_at)
          : undefined,
    archived_at:
      body.archived_at === null
        ? null
        : body.archived_at
          ? new Date(body.archived_at)
          : undefined,
  });

  if (!session) {
    throw new ApiError(500, "Unable to update session");
  }

  return sessionPayload(session);
};

export const deleteSessionHandler = async (
  seminarId: string,
  sessionId: string,
): Promise<{ message: string; data: null }> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const existingSession = await getSessionById(db, sessionId);

  if (!existingSession || existingSession.seminar_id !== seminarId) {
    throw new ApiError(404, "Session not found");
  }

  await deleteSession(db, sessionId);

  return { message: "Session deleted successfully.", data: null };
};

export const participantPayload = <T extends Record<string, unknown>>(
  participant: T,
): ParticipantResponse => ({
  message: "Participant loaded successfully.",
  data: serializeApiDates(participant) as unknown as Participant,
});

export const participantListPayload = <T extends Record<string, unknown>>(
  participants: T[],
): ParticipantResponse[] =>
  participants.map((participant) => ({
    message: "Participant loaded successfully.",
    data: serializeApiDates(participant) as unknown as Participant,
  }));

type ParticipantRecord = {
  id: number;
  name: string;
  discord_user_id: string;
  created_at?: Date | string;
  updated_at?: Date | string;
};

export const resolveParticipantRecord = (
  matchingName: ParticipantRecord | null,
  matchingDiscord: ParticipantRecord | null,
): ParticipantRecord | null => {
  if (matchingName) {
    return matchingName;
  }

  return matchingDiscord;
};

export const getAllParticipantsHandler = async (): Promise<
  ParticipantResponse[]
> => {
  const participants = await getParticipants(db);
  return participantListPayload(participants);
};

export const getParticipantsHandler = async (
  seminarId: string,
): Promise<ParticipantResponse[]> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const links = await getSeminarParticipants(db, seminarId);
  const participants = await Promise.all(
    links.map(
      async (link) => await getParticipantById(db, link.participant_id),
    ),
  );

  return participantListPayload(
    participants.filter(
      (
        participant,
      ): participant is {
        id: number;
        name: string;
        discord_user_id: string;
        created_at: Date;
        updated_at: Date;
      } => Boolean(participant),
    ),
  );
};

export const getParticipantHandler = async (
  seminarId: string,
  participantId: number,
): Promise<ParticipantResponse> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const relation = await getSeminarParticipantByPair(
    db,
    seminarId,
    participantId,
  );
  if (!relation) {
    throw new ApiError(404, "Participant not found in this seminar");
  }

  const participant = await getParticipantById(db, participantId);
  if (!participant) {
    throw new ApiError(404, "Participant not found");
  }

  return participantPayload(participant);
};

export const createParticipantHandler = async (
  seminarId: string,
  body: ParticipantCreate,
): Promise<ParticipantResponse> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const trimmedName = body.name.trim();
  const trimmedDiscordUserId = body.discord_user_id.trim();

  const matchingName = await getParticipantByName(db, trimmedName);
  const matchingDiscord = await getParticipantByDiscordUserId(
    db,
    trimmedDiscordUserId,
  );

  const participant =
    resolveParticipantRecord(matchingName, matchingDiscord) ??
    (await createParticipant(db, {
      name: trimmedName,
      discord_user_id: trimmedDiscordUserId,
    }));

  if (!participant) {
    throw new ApiError(500, "Unable to create participant");
  }

  const existingRelation = await getSeminarParticipantByPair(
    db,
    seminarId,
    participant.id,
  );

  if (!existingRelation) {
    const relation = await createSeminarParticipant(db, {
      seminar_id: seminarId,
      participant_id: participant.id,
    });

    if (!relation) {
      throw new ApiError(500, "Unable to join participant to seminar");
    }
  }

  return participantPayload(participant);
};

export const updateParticipantHandler = async (
  seminarId: string,
  participantId: number,
  body: ParticipantUpdate,
): Promise<ParticipantResponse> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const relation = await getSeminarParticipantByPair(
    db,
    seminarId,
    participantId,
  );
  if (!relation) {
    throw new ApiError(404, "Participant not found in this seminar");
  }

  const participant = await updateParticipant(db, participantId, body);
  if (!participant) {
    throw new ApiError(500, "Unable to update participant");
  }

  return participantPayload(participant);
};

export const deleteParticipantHandler = async (
  seminarId: string,
  participantId: number,
): Promise<{ message: string; data: null }> => {
  const seminar = await getSeminarById(db, seminarId);

  if (!seminar) {
    throw new ApiError(404, "Seminar not found");
  }

  const relation = await getSeminarParticipantByPair(
    db,
    seminarId,
    participantId,
  );
  if (!relation) {
    throw new ApiError(404, "Participant not found in this seminar");
  }

  await deleteSeminarParticipant(db, relation.id);

  return {
    message: "Participant removed from seminar successfully.",
    data: null,
  };
};
