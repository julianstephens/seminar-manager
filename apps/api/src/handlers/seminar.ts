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

import { ApiError } from "./index";

export const seminarPayload = (seminar: Seminar): SeminarResponse => ({
  message: "Seminar loaded successfully.",
  data: seminar,
});

export const seminarListPayload = (seminars: Seminar[]): SeminarResponse[] =>
  seminars.map((seminar) => ({
    message: "Seminar loaded successfully.",
    data: seminar,
  }));

export const sessionPayload = (session: Session): SessionResponse => ({
  message: "Session loaded successfully.",
  data: session,
});

export const sessionListPayload = (sessions: Session[]): SessionResponse[] =>
  sessions.map((session) => ({
    message: "Session loaded successfully.",
    data: session,
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

  const session = await updateSession(db, sessionId, body);

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

export const participantPayload = (
  participant: Participant,
): ParticipantResponse => ({
  message: "Participant loaded successfully.",
  data: participant,
});

export const participantListPayload = (
  participants: Participant[],
): ParticipantResponse[] =>
  participants.map((participant) => ({
    message: "Participant loaded successfully.",
    data: participant,
  }));

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
    participants.filter((participant): participant is Participant =>
      Boolean(participant),
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

  let participant = await getParticipantByDiscordUserId(
    db,
    body.discord_user_id,
  );

  if (!participant) {
    participant = await createParticipant(db, body);
  }

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
