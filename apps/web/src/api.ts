import { authFetch, readApiErrorMessage } from "@/utils";
import type {
  AssignmentResponse,
  ParticipantCreate,
  ParticipantResponse,
  PublicationRecordResponse,
  ResourceResponse,
  SeminarCreate,
  SeminarResponse,
  SeminarUpdate,
  SessionCreate,
  SessionResponse,
  SessionUpdate,
} from "schemas";

export const seminarQueryKeys = {
  all: ["seminars"] as const,
  list: () => [...seminarQueryKeys.all],
  detail: (seminarId: string) => [...seminarQueryKeys.all, seminarId] as const,
};

export const participantQueryKeys = {
  all: ["participants"] as const,
  directory: () => [...participantQueryKeys.all] as const,
  list: (seminarId: string) =>
    [...participantQueryKeys.all, "seminar", seminarId] as const,
};

export const sessionQueryKeys = {
  all: ["sessions"] as const,
  list: (seminarId: string) =>
    [...sessionQueryKeys.all, "seminar", seminarId] as const,
  detail: (seminarId: string, sessionId: string) =>
    [...sessionQueryKeys.list(seminarId), sessionId] as const,
};

export const resourceQueryKeys = {
  all: ["resources"] as const,
  list: (sessionId: string) =>
    [...resourceQueryKeys.all, "session", sessionId] as const,
};

export const assignmentQueryKeys = {
  all: ["assignments"] as const,
  list: (sessionId: string) =>
    [...assignmentQueryKeys.all, "session", sessionId] as const,
};

export const publicationRecordQueryKeys = {
  all: ["publication-records"] as const,
  list: (sessionId: string) =>
    [...publicationRecordQueryKeys.all, "session", sessionId] as const,
};

export const fetchSeminars = async (): Promise<SeminarResponse[]> => {
  const response = await authFetch("/api/seminars");

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load seminars.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SeminarResponse[];
};

export const fetchSeminarById = async (
  seminarId: string,
): Promise<SeminarResponse> => {
  const response = await authFetch(`/api/seminars/${seminarId}`);

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load seminar.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SeminarResponse;
};

export const updateSeminar = async (
  seminarId: string,
  payload: SeminarUpdate,
): Promise<SeminarResponse> => {
  const response = await authFetch(`/api/seminars/${seminarId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to update seminar.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SeminarResponse;
};

export const createSeminar = async (
  payload: SeminarCreate,
): Promise<SeminarResponse> => {
  const response = await authFetch("/api/seminars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to create seminar.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SeminarResponse;
};

export const fetchParticipants = async (): Promise<ParticipantResponse[]> => {
  const response = await authFetch("/api/participants");

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load participants.",
    );
    throw new Error(message);
  }

  return (await response.json()) as ParticipantResponse[];
};

export const fetchSeminarParticipants = async (
  seminarId: string,
): Promise<ParticipantResponse[]> => {
  const response = await authFetch(`/api/seminars/${seminarId}/participants`);

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load participants.",
    );
    throw new Error(message);
  }

  return (await response.json()) as ParticipantResponse[];
};

export const createParticipant = async (
  seminarId: string,
  payload: ParticipantCreate,
): Promise<ParticipantResponse> => {
  const response = await authFetch(`/api/seminars/${seminarId}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to create participant.",
    );
    throw new Error(message);
  }

  return (await response.json()) as ParticipantResponse;
};

export const fetchSessions = async (
  seminarId: string,
): Promise<SessionResponse[]> => {
  const response = await authFetch(`/api/seminars/${seminarId}/sessions`);

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load sessions.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SessionResponse[];
};

export const fetchSessionById = async (
  seminarId: string,
  sessionId: string,
): Promise<SessionResponse> => {
  const response = await authFetch(
    `/api/seminars/${seminarId}/sessions/${sessionId}`,
  );

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load session.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SessionResponse;
};

export const createSession = async (
  seminarId: string,
  payload: SessionCreate,
): Promise<SessionResponse> => {
  const response = await authFetch(`/api/seminars/${seminarId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to create session.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SessionResponse;
};

export const updateSession = async (
  seminarId: string,
  sessionId: string,
  payload: SessionUpdate,
): Promise<SessionResponse> => {
  const response = await authFetch(
    `/api/seminars/${seminarId}/sessions/${sessionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to update session.",
    );
    throw new Error(message);
  }

  return (await response.json()) as SessionResponse;
};

export const fetchResources = async (
  sessionId: string,
): Promise<ResourceResponse[]> => {
  const response = await authFetch(`/api/resources?session_id=${sessionId}`);

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load resources.",
    );
    throw new Error(message);
  }

  return (await response.json()) as ResourceResponse[];
};

export const fetchAssignments = async (
  sessionId: string,
): Promise<AssignmentResponse[]> => {
  const response = await authFetch(`/api/assignments?session_id=${sessionId}`);

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load assignments.",
    );
    throw new Error(message);
  }

  return (await response.json()) as AssignmentResponse[];
};

export const fetchPublicationRecords = async (
  sessionId: string,
): Promise<PublicationRecordResponse[]> => {
  const response = await authFetch(
    `/api/publication-records?session_id=${sessionId}`,
  );

  if (!response.ok) {
    const message = await readApiErrorMessage(
      response,
      "Unable to load publication records.",
    );
    throw new Error(message);
  }

  return (await response.json()) as PublicationRecordResponse[];
};

export const saveSessionDraft = async (
  seminarId: string,
  sessionId: string,
  payload: SessionUpdate,
): Promise<SessionResponse> => {
  return await updateSession(seminarId, sessionId, {
    ...payload,
    published_at: null,
  });
};

export const publishSession = async (
  seminarId: string,
  sessionId: string,
  payload: SessionUpdate,
): Promise<SessionResponse> => {
  return await updateSession(seminarId, sessionId, {
    ...payload,
    published_at: new Date().toISOString(),
  });
};
