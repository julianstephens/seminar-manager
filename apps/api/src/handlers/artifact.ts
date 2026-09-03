import db from "@/db";
import {
  createAssignment,
  createPublicationRecord,
  createResource,
  deleteAssignment,
  deletePublicationRecord,
  deleteResource,
  getAssignmentById,
  getAssignmentBySessionAndParticipant,
  getAssignmentsBySession,
  getPublicationRecordById,
  getPublicationRecordsBySession,
  getResourceById,
  getResourcesBySession,
  getSessionById,
  updatePublicationRecord,
  updateResource,
} from "@/repos";
import type {
  Assignment,
  AssignmentCreate,
  AssignmentResponse,
  PublicationRecord,
  PublicationRecordCreate,
  PublicationRecordResponse,
  PublicationRecordUpdate,
  Resource,
  ResourceCreate,
  ResourceResponse,
  ResourceUpdate,
} from "schemas";

import { serializeApiDates } from "./format";
import { ApiError } from "./index";

export const resourcePayload = <T extends Record<string, unknown>>(
  resource: T,
): ResourceResponse => ({
  message: "Resource loaded successfully.",
  data: serializeApiDates(resource) as unknown as Resource,
});

export const resourceListPayload = <T extends Record<string, unknown>>(
  resources: T[],
): ResourceResponse[] =>
  resources.map((resource) => ({
    message: "Resource loaded successfully.",
    data: serializeApiDates(resource) as unknown as Resource,
  }));

export const assignmentPayload = <T extends Record<string, unknown>>(
  assignment: T,
): AssignmentResponse => ({
  message: "Assignment loaded successfully.",
  data: serializeApiDates(assignment) as unknown as Assignment,
});

export const assignmentListPayload = <T extends Record<string, unknown>>(
  assignments: T[],
): AssignmentResponse[] =>
  assignments.map((assignment) => ({
    message: "Assignment loaded successfully.",
    data: serializeApiDates(assignment) as unknown as Assignment,
  }));

export const publicationRecordPayload = <T extends Record<string, unknown>>(
  record: T,
): PublicationRecordResponse => ({
  message: "Publication record loaded successfully.",
  data: serializeApiDates(record) as unknown as PublicationRecord,
});

export const publicationRecordListPayload = <T extends Record<string, unknown>>(
  records: T[],
): PublicationRecordResponse[] =>
  records.map((record) => ({
    message: "Publication record loaded successfully.",
    data: serializeApiDates(record) as unknown as PublicationRecord,
  }));

const getSessionOrThrow = async (sessionId: string) => {
  const session = await getSessionById(db, sessionId);

  if (!session) {
    throw new ApiError(404, "Session not found");
  }

  return session;
};

export const getResourcesHandler = async (
  sessionId: string,
): Promise<ResourceResponse[]> => {
  await getSessionOrThrow(sessionId);

  const resources = await getResourcesBySession(db, sessionId);
  return resourceListPayload(resources);
};

export const getResourceHandler = async (
  resourceId: string,
  sessionId: string,
): Promise<ResourceResponse> => {
  await getSessionOrThrow(sessionId);

  const resource = await getResourceById(db, resourceId);

  if (!resource || resource.session_id !== sessionId) {
    throw new ApiError(404, "Resource not found");
  }

  return resourcePayload(resource);
};

export const createResourceHandler = async (
  body: ResourceCreate,
): Promise<ResourceResponse> => {
  await getSessionOrThrow(body.session_id);

  const resource = await createResource(db, body);

  if (!resource) {
    throw new ApiError(500, "Unable to create resource");
  }

  return resourcePayload(resource);
};

export const updateResourceHandler = async (
  resourceId: string,
  body: ResourceUpdate,
): Promise<ResourceResponse> => {
  const sessionId =
    body.session_id ?? (await getResourceById(db, resourceId))?.session_id;

  if (!sessionId) {
    throw new ApiError(404, "Resource not found");
  }

  await getSessionOrThrow(sessionId);

  const currentResource = await getResourceById(db, resourceId);

  if (!currentResource || currentResource.session_id !== sessionId) {
    throw new ApiError(404, "Resource not found");
  }

  const resource = await updateResource(db, resourceId, body);

  if (!resource) {
    throw new ApiError(500, "Unable to update resource");
  }

  return resourcePayload(resource);
};

export const deleteResourceHandler = async (
  resourceId: string,
  sessionId: string,
): Promise<{ message: string; data: null }> => {
  await getSessionOrThrow(sessionId);

  const resource = await getResourceById(db, resourceId);

  if (!resource || resource.session_id !== sessionId) {
    throw new ApiError(404, "Resource not found");
  }

  await deleteResource(db, resourceId);

  return { message: "Resource deleted successfully.", data: null };
};

export const getAssignmentsHandler = async (
  sessionId: string,
): Promise<AssignmentResponse[]> => {
  await getSessionOrThrow(sessionId);

  const assignments = await getAssignmentsBySession(db, sessionId);
  return assignmentListPayload(assignments);
};

export const getAssignmentHandler = async (
  assignmentId: string,
  sessionId: string,
): Promise<AssignmentResponse> => {
  await getSessionOrThrow(sessionId);

  const assignment = await getAssignmentById(db, assignmentId);

  if (!assignment || assignment.session_id !== sessionId) {
    throw new ApiError(404, "Assignment not found");
  }

  return assignmentPayload(assignment);
};

export const createAssignmentHandler = async (
  body: AssignmentCreate,
): Promise<AssignmentResponse> => {
  await getSessionOrThrow(body.session_id);

  const existingAssignment = await getAssignmentBySessionAndParticipant(
    db,
    body.session_id,
    body.participant_id,
  );

  if (existingAssignment) {
    throw new ApiError(
      409,
      "Assignment already exists for this participant in the session",
    );
  }

  const assignment = await createAssignment(db, body);

  if (!assignment) {
    throw new ApiError(500, "Unable to create assignment");
  }

  return assignmentPayload(assignment);
};

export const deleteAssignmentHandler = async (
  assignmentId: string,
  sessionId: string,
): Promise<{ message: string; data: null }> => {
  await getSessionOrThrow(sessionId);

  const assignment = await getAssignmentById(db, assignmentId);

  if (!assignment || assignment.session_id !== sessionId) {
    throw new ApiError(404, "Assignment not found");
  }

  await deleteAssignment(db, assignmentId);

  return { message: "Assignment deleted successfully.", data: null };
};

export const getPublicationRecordsHandler = async (
  sessionId: string,
): Promise<PublicationRecordResponse[]> => {
  await getSessionOrThrow(sessionId);

  const records = await getPublicationRecordsBySession(db, sessionId);
  return publicationRecordListPayload(records);
};

export const getPublicationRecordHandler = async (
  recordId: number,
  sessionId: string,
): Promise<PublicationRecordResponse> => {
  await getSessionOrThrow(sessionId);

  const record = await getPublicationRecordById(db, recordId);

  if (!record || record.session_id !== sessionId) {
    throw new ApiError(404, "Publication record not found");
  }

  return publicationRecordPayload(record);
};

export const createPublicationRecordHandler = async (
  body: PublicationRecordCreate,
): Promise<PublicationRecordResponse> => {
  await getSessionOrThrow(body.session_id);

  const record = await createPublicationRecord(db, body);

  if (!record) {
    throw new ApiError(500, "Unable to create publication record");
  }

  return publicationRecordPayload(record);
};

export const updatePublicationRecordHandler = async (
  recordId: number,
  body: PublicationRecordUpdate,
): Promise<PublicationRecordResponse> => {
  const sessionId =
    body.session_id ??
    (await getPublicationRecordById(db, recordId))?.session_id;

  if (!sessionId) {
    throw new ApiError(404, "Publication record not found");
  }

  await getSessionOrThrow(sessionId);

  const currentRecord = await getPublicationRecordById(db, recordId);

  if (!currentRecord || currentRecord.session_id !== sessionId) {
    throw new ApiError(404, "Publication record not found");
  }

  const record = await updatePublicationRecord(db, recordId, body);

  if (!record) {
    throw new ApiError(500, "Unable to update publication record");
  }

  return publicationRecordPayload(record);
};

export const deletePublicationRecordHandler = async (
  recordId: number,
  sessionId: string,
): Promise<{ message: string; data: null }> => {
  await getSessionOrThrow(sessionId);

  const record = await getPublicationRecordById(db, recordId);

  if (!record || record.session_id !== sessionId) {
    throw new ApiError(404, "Publication record not found");
  }

  await deletePublicationRecord(db, recordId);

  return { message: "Publication record deleted successfully.", data: null };
};
