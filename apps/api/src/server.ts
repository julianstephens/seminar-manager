import db from "@/db";
import { ApiError } from "@/handlers";
import {
  createAssignmentHandler,
  createResourceHandler,
  deleteAssignmentHandler,
  deleteResourceHandler,
  getAssignmentsHandler,
  getPublicationRecordHandler,
  getPublicationRecordsHandler,
  getResourcesHandler,
  updateResourceHandler,
} from "@/handlers/artifact";
import {
  extractBearerToken,
  loginHandler,
  logoutHandler,
} from "@/handlers/auth";
import {
  createParticipantHandler,
  createSeminarHandler,
  createSessionHandler,
  deleteSeminarHandler,
  deleteSessionHandler,
  getAllParticipantsHandler,
  getParticipantsHandler,
  getSeminarHandler,
  getSeminarsHandler,
  getSessionsHandler,
  participantPayload,
  sessionPayload,
  updateParticipantHandler,
  updateSeminarHandler,
  updateSessionHandler,
} from "@/handlers/seminar";
import {
  createParticipant,
  createPublicationRecord,
  getAssignmentById,
  getParticipantByDiscordUserId,
  getParticipantById,
  getParticipantByName,
  getPublicationRecordById,
  getPublicationRecordsBySession,
  getResourceById,
  getSeminarParticipants,
  getSessionById,
  updateSession,
} from "@/repos";
import { getAuthSession } from "@/repos/auth";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import {
  ApiErrorResponseSchema,
  AssignmentResponseSchema,
  LoginResponseSchema,
  LoginSchema,
  LogoutErrorResponseSchema,
  LogoutResponseSchema,
  ParticipantCreateSchema,
  ParticipantResponseSchema,
  ParticipantUpdateSchema,
  PublicationRecordResponseSchema,
  ResourceCreateSchema,
  ResourceResponseSchema,
  ResourceUpdateSchema,
  SeminarCreateSchema,
  SeminarResponseSchema,
  SeminarUpdateSchema,
  SessionCreateSchema,
  SessionResponseSchema,
  SessionUpdateSchema,
} from "schemas";
import { z } from "zod";
import { toRequestErrorResponse } from "./error-response";

export const setupApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Seminar Manager API",
        description: "REST API for managing seminars and their resources",
        version: "1.0.0",
      },
      servers: [],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: "/docs",
  });

  app.addHook("preHandler", async (request) => {
    const requestPath = request.url.split("?")[0];
    const publicRoutes = ["/api/auth/login", "/api/auth/logout"];
    const isPublicRequest =
      (publicRoutes.includes(requestPath) && request.method === "POST") ||
      requestPath.startsWith("/docs");

    if (isPublicRequest) {
      return;
    }

    const accessToken = extractBearerToken(request.headers.authorization);

    if (!accessToken) {
      throw new ApiError(401, "Authentication required");
    }

    const session = await getAuthSession(db, accessToken);

    if (!session || session.status !== "active") {
      throw new ApiError(401, "Invalid session");
    }

    if (session.expires_at.getTime() <= Date.now()) {
      throw new ApiError(401, "Session expired");
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      const apiError = err as ApiError;
      return reply
        .code(apiError.statusCode)
        .send(
          toRequestErrorResponse(apiError.statusCode, apiError.message, req),
        );
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send(
        toRequestErrorResponse(400, "Request doesn't match the schema", req, {
          issues: err.validation,
        }),
      );
    }

    if (isResponseSerializationError(err)) {
      return reply.code(500).send(
        toRequestErrorResponse(500, "Response doesn't match the schema", req, {
          issues: err.cause.issues,
        }),
      );
    }

    return reply.code(500).send(
      toRequestErrorResponse(500, "An unexpected error occurred", req, {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/api/auth/login",
    schema: {
      tags: ["auth"],
      body: LoginSchema,
      response: {
        200: LoginResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await loginHandler(request.body);
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/auth/logout",
    schema: {
      tags: ["auth"],
      response: {
        200: LogoutResponseSchema,
        401: LogoutErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const accessToken = extractBearerToken(request.headers.authorization);

      if (!accessToken) {
        throw new ApiError(401, "Authentication required");
      }

      await logoutHandler(accessToken);
      return { success: true, message: "Session revoked successfully." };
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/seminars",
    schema: {
      tags: ["seminars"],
      response: {
        200: SeminarResponseSchema.array(),
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (_request, _reply) => {
      return await getSeminarsHandler();
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/seminars/:seminar_id",
    schema: {
      tags: ["seminars"],
      params: z.object({ seminar_id: z.uuid() }),
      response: {
        200: SeminarResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await getSeminarHandler(request.params.seminar_id);
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/seminars",
    schema: {
      tags: ["seminars"],
      body: SeminarCreateSchema,
      response: {
        200: SeminarResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await createSeminarHandler(request.body);
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/seminars/:seminar_id/sessions",
    schema: {
      tags: ["sessions"],
      params: z.object({ seminar_id: z.uuid() }),
      response: {
        200: SessionResponseSchema.array(),
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await getSessionsHandler(request.params.seminar_id);
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/seminars/:seminar_id/sessions",
    schema: {
      tags: ["sessions"],
      params: z.object({ seminar_id: z.uuid() }),
      body: SessionCreateSchema,
      response: {
        200: SessionResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await createSessionHandler(
        request.params.seminar_id,
        request.body,
      );
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/sessions/:id",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: SessionResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const session = await getSessionById(db, request.params.id);

      if (!session) {
        throw new ApiError(404, "Session not found");
      }

      return sessionPayload(session);
    },
  });

  typedApp.route({
    method: "PATCH",
    url: "/api/sessions/:id",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      body: SessionUpdateSchema,
      response: {
        200: SessionResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const session = await updateSession(db, request.params.id, {
        ...request.body,
        date: request.body.date ? new Date(request.body.date) : undefined,
        published_at:
          request.body.published_at === null
            ? null
            : request.body.published_at
              ? new Date(request.body.published_at)
              : undefined,
        archived_at:
          request.body.archived_at === null
            ? null
            : request.body.archived_at
              ? new Date(request.body.archived_at)
              : undefined,
      });

      if (!session) {
        throw new ApiError(404, "Session not found");
      }

      return sessionPayload(session);
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/sessions/:id/resources",
    schema: {
      tags: ["resources"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: ResourceResponseSchema.array(),
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await getResourcesHandler(request.params.id);
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/sessions/:id/resources",
    schema: {
      tags: ["resources"],
      params: z.object({ id: z.uuid() }),
      body: ResourceCreateSchema,
      response: {
        200: ResourceResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await createResourceHandler({
        ...request.body,
        session_id: request.params.id,
      });
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/sessions/:id/assignments",
    schema: {
      tags: ["assignments"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: AssignmentResponseSchema.array(),
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await getAssignmentsHandler(request.params.id);
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/sessions/:id/assignments",
    schema: {
      tags: ["assignments"],
      params: z.object({ id: z.uuid() }),
      body: z.object({
        participant_id: z.number().int().positive(),
        resource_id: z.uuid(),
      }),
      response: {
        200: AssignmentResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await createAssignmentHandler({
        ...request.body,
        session_id: request.params.id,
      });
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/publication-records",
    schema: {
      tags: ["publication-records"],
      querystring: z.object({ session_id: z.uuid() }),
      response: {
        200: PublicationRecordResponseSchema.array(),
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await getPublicationRecordsHandler(request.query.session_id);
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/participants",
    schema: {
      tags: ["participants"],
      response: {
        200: ParticipantResponseSchema.array(),
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (_request, _reply) => {
      return await getAllParticipantsHandler();
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/participants",
    schema: {
      tags: ["participants"],
      body: ParticipantCreateSchema,
      response: {
        200: ParticipantResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const trimmedName = request.body.name.trim();
      const trimmedDiscordUserId = request.body.discord_user_id.trim();

      const matchingName = await getParticipantByName(db, trimmedName);
      const matchingDiscord = await getParticipantByDiscordUserId(
        db,
        trimmedDiscordUserId,
      );

      const participant =
        matchingName ??
        matchingDiscord ??
        (await createParticipant(db, {
          name: trimmedName,
          discord_user_id: trimmedDiscordUserId,
        }));

      if (!participant) {
        throw new ApiError(500, "Unable to create participant");
      }

      return participantPayload(participant);
    },
  });

  typedApp.route({
    method: "GET",
    url: "/api/seminars/:seminar_id/participants",
    schema: {
      tags: ["participants"],
      params: z.object({ seminar_id: z.uuid() }),
      response: {
        200: ParticipantResponseSchema.array(),
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await getParticipantsHandler(request.params.seminar_id);
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/seminars/:seminar_id/participants",
    schema: {
      tags: ["participants"],
      params: z.object({ seminar_id: z.uuid() }),
      body: ParticipantCreateSchema,
      response: {
        200: ParticipantResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await createParticipantHandler(
        request.params.seminar_id,
        request.body,
      );
    },
  });

  // PATCH /api/seminars/:seminar_id
  typedApp.route({
    method: "PATCH",
    url: "/api/seminars/:seminar_id",
    schema: {
      tags: ["seminars"],
      params: z.object({ seminar_id: z.uuid() }),
      body: SeminarUpdateSchema,
      response: {
        200: SeminarResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await updateSeminarHandler(
        request.params.seminar_id,
        request.body,
      );
    },
  });

  // DELETE /api/seminars/:seminar_id
  typedApp.route({
    method: "DELETE",
    url: "/api/seminars/:seminar_id",
    schema: {
      tags: ["seminars"],
      params: z.object({ seminar_id: z.uuid() }),
      response: {
        200: z.object({ message: z.string(), data: z.null() }),
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await deleteSeminarHandler(request.params.seminar_id);
    },
  });

  // DELETE /api/sessions/:id
  typedApp.route({
    method: "DELETE",
    url: "/api/sessions/:id",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: z.object({ message: z.string(), data: z.null() }),
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const session = await getSessionById(db, request.params.id);
      if (!session) throw new ApiError(404, "Session not found");
      return await deleteSessionHandler(session.seminar_id, request.params.id);
    },
  });

  // POST /api/sessions/:id/publish
  typedApp.route({
    method: "POST",
    url: "/api/sessions/:id/publish",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: SessionResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const session = await getSessionById(db, request.params.id);
      if (!session) throw new ApiError(404, "Session not found");

      const existingRecords = await getPublicationRecordsBySession(
        db,
        session.id,
      );
      if (session.published_at && existingRecords.length > 0) {
        return sessionPayload(session);
      }

      const updatedSession = await updateSessionHandler(
        session.seminar_id,
        session.id,
        {
          published_at: new Date().toISOString(),
        },
      );

      const seminarParticipants = await getSeminarParticipants(
        db,
        session.seminar_id,
      );
      const participantId =
        seminarParticipants[0]?.participant_id ?? session.session_number;

      await createPublicationRecord(db, {
        session_id: session.id,
        action: existingRecords.length === 0 ? "created" : "updated",
        participant_id: participantId,
        external_id: session.id,
        status: "success",
        error: null,
      });

      return updatedSession;
    },
  });

  // POST /api/sessions/:id/archive
  typedApp.route({
    method: "POST",
    url: "/api/sessions/:id/archive",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: SessionResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const session = await getSessionById(db, request.params.id);
      if (!session) throw new ApiError(404, "Session not found");
      return await updateSessionHandler(session.seminar_id, request.params.id, {
        archived_at: new Date().toISOString(),
      });
    },
  });

  // PATCH /api/resources/:id
  typedApp.route({
    method: "PATCH",
    url: "/api/resources/:id",
    schema: {
      tags: ["resources"],
      params: z.object({ id: z.uuid() }),
      body: ResourceUpdateSchema,
      response: {
        200: ResourceResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await updateResourceHandler(request.params.id, request.body);
    },
  });

  // DELETE /api/resources/:id
  typedApp.route({
    method: "DELETE",
    url: "/api/resources/:id",
    schema: {
      tags: ["resources"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: z.object({ message: z.string(), data: z.null() }),
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const resource = await getResourceById(db, request.params.id);
      if (!resource) throw new ApiError(404, "Resource not found");
      return await deleteResourceHandler(
        request.params.id,
        resource.session_id,
      );
    },
  });

  // DELETE /api/assignments/:id
  typedApp.route({
    method: "DELETE",
    url: "/api/assignments/:id",
    schema: {
      tags: ["assignments"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: z.object({ message: z.string(), data: z.null() }),
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const assignment = await getAssignmentById(db, request.params.id);
      if (!assignment) throw new ApiError(404, "Assignment not found");
      return await deleteAssignmentHandler(
        request.params.id,
        assignment.session_id,
      );
    },
  });

  // PATCH /api/seminars/:seminar_id/participants/:participant_id
  typedApp.route({
    method: "PATCH",
    url: "/api/seminars/:seminar_id/participants/:participant_id",
    schema: {
      tags: ["participants"],
      params: z.object({
        seminar_id: z.uuid(),
        participant_id: z.number().int().positive(),
      }),
      body: ParticipantUpdateSchema,
      response: {
        200: ParticipantResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const participant = await getParticipantById(
        db,
        request.params.participant_id,
      );
      if (!participant) throw new ApiError(404, "Participant not found");
      return await updateParticipantHandler(
        request.params.seminar_id,
        request.params.participant_id,
        request.body,
      );
    },
  });

  // GET /api/publication-records/:id
  typedApp.route({
    method: "GET",
    url: "/api/publication-records/:id",
    schema: {
      tags: ["publication-records"],
      params: z.object({ id: z.number().int().positive() }),
      response: {
        200: PublicationRecordResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      const record = await getPublicationRecordById(db, request.params.id);
      if (!record) throw new ApiError(404, "Publication record not found");
      return await getPublicationRecordHandler(
        request.params.id,
        record.session_id,
      );
    },
  });

  return app;
};
