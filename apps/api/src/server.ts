import db from "@/db";
import { ApiError } from "@/handlers";
import {
  extractBearerToken,
  loginHandler,
  logoutHandler,
} from "@/handlers/auth";
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
  ApiResponseSchema,
  AssignmentCreateSchema,
  AssignmentResponseSchema,
  LoginResponseSchema,
  LoginSchema,
  LogoutErrorResponseSchema,
  LogoutResponseSchema,
  ParticipantCreateSchema,
  ParticipantResponseSchema,
  ParticipantUpdateSchema,
  PublicationRecordCreateSchema,
  PublicationRecordResponseSchema,
  PublicationRecordUpdateSchema,
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

import {
  createAssignmentHandler,
  createPublicationRecordHandler,
  createResourceHandler,
  deleteAssignmentHandler,
  deletePublicationRecordHandler,
  deleteResourceHandler,
  getAssignmentHandler,
  getAssignmentsHandler,
  getPublicationRecordHandler,
  getPublicationRecordsHandler,
  getResourceHandler,
  getResourcesHandler,
  updatePublicationRecordHandler,
  updateResourceHandler,
} from "@/handlers/artifact";
import {
  createParticipantHandler,
  createSeminarHandler,
  createSessionHandler,
  deleteParticipantHandler,
  deleteSeminarHandler,
  getAllParticipantsHandler,
  getParticipantHandler,
  getParticipantsHandler,
  getSeminarHandler,
  getSeminarsHandler,
  getSessionHandler,
  getSessionsHandler,
  updateParticipantHandler,
  updateSeminarHandler,
  updateSessionHandler,
} from "@/handlers/seminar";
import { getAuthSession } from "@/repos/auth";
import path from "path";
import { Worker } from "worker_threads";
import { buildDbCleanerWorkerData } from "./db-cleaner";
import { env } from "./env";

export const setupApp = (): FastifyInstance => {
  const app = Fastify({
    logger: true,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(fastifySwagger, {
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
  app.register(fastifySwaggerUI, {
    routePrefix: "/docs",
  });

  app.addHook("preHandler", async (request) => {
    const publicRoutes = ["/auth/login", "/auth/logout"];
    const isPublicRequest =
      request.method === "POST" && publicRoutes.includes(request.url);

    if (isPublicRequest) {
      return;
    }

    const authHeader = request.headers.authorization;
    const accessToken = extractBearerToken(authHeader);

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

  app.after(() => {
    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/auth/login",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/auth/logout",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/seminars",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/seminars/:seminar_id",
      schema: {
        tags: ["seminars"],
        params: z.object({ seminar_id: z.string() }),
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/seminars",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "PATCH",
      url: "/seminars/:seminar_id",
      schema: {
        tags: ["seminars"],
        params: z.object({ seminar_id: z.uuid() }),
        body: SeminarUpdateSchema,
        response: {
          200: SeminarResponseSchema,
          400: ApiErrorResponseSchema,
          401: ApiErrorResponseSchema,
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "DELETE",
      url: "/seminars/:seminar_id",
      schema: {
        tags: ["seminars"],
        params: z.object({ seminar_id: z.uuid() }),
        response: {
          200: ApiResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await deleteSeminarHandler(request.params.seminar_id);
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/seminars/:seminar_id/sessions",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/seminars/:seminar_id/sessions/:session_id",
      schema: {
        tags: ["sessions"],
        params: z.object({ seminar_id: z.uuid(), session_id: z.uuid() }),
        response: {
          200: SessionResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await getSessionHandler(
          request.params.seminar_id,
          request.params.session_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/seminars/:seminar_id/sessions",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "PATCH",
      url: "/seminars/:seminar_id/sessions/:session_id",
      schema: {
        tags: ["sessions"],
        params: z.object({ seminar_id: z.uuid(), session_id: z.uuid() }),
        body: SessionUpdateSchema,
        response: {
          200: SessionResponseSchema,
          400: ApiErrorResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await updateSessionHandler(
          request.params.seminar_id,
          request.params.session_id,
          request.body,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/resources",
      schema: {
        tags: ["resources"],
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: ResourceResponseSchema.array(),
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await getResourcesHandler(request.query.session_id);
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/resources/:resource_id",
      schema: {
        tags: ["resources"],
        params: z.object({ resource_id: z.uuid() }),
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: ResourceResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await getResourceHandler(
          request.params.resource_id,
          request.query.session_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/resources",
      schema: {
        tags: ["resources"],
        body: ResourceCreateSchema,
        response: {
          200: ResourceResponseSchema,
          400: ApiErrorResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await createResourceHandler(request.body);
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "PATCH",
      url: "/resources/:resource_id",
      schema: {
        tags: ["resources"],
        params: z.object({ resource_id: z.uuid() }),
        body: ResourceUpdateSchema,
        response: {
          200: ResourceResponseSchema,
          400: ApiErrorResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await updateResourceHandler(
          request.params.resource_id,
          request.body,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "DELETE",
      url: "/resources/:resource_id",
      schema: {
        tags: ["resources"],
        params: z.object({ resource_id: z.uuid() }),
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: ApiResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await deleteResourceHandler(
          request.params.resource_id,
          request.query.session_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/assignments",
      schema: {
        tags: ["assignments"],
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: AssignmentResponseSchema.array(),
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await getAssignmentsHandler(request.query.session_id);
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/assignments/:assignment_id",
      schema: {
        tags: ["assignments"],
        params: z.object({ assignment_id: z.uuid() }),
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: AssignmentResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await getAssignmentHandler(
          request.params.assignment_id,
          request.query.session_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/assignments",
      schema: {
        tags: ["assignments"],
        body: AssignmentCreateSchema,
        response: {
          200: AssignmentResponseSchema,
          400: ApiErrorResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await createAssignmentHandler(request.body);
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "DELETE",
      url: "/assignments/:assignment_id",
      schema: {
        tags: ["assignments"],
        params: z.object({ assignment_id: z.uuid() }),
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: ApiResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await deleteAssignmentHandler(
          request.params.assignment_id,
          request.query.session_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/publication-records",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/publication-records/:publication_record_id",
      schema: {
        tags: ["publication-records"],
        params: z.object({
          publication_record_id: z.number().int().positive(),
        }),
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: PublicationRecordResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await getPublicationRecordHandler(
          request.params.publication_record_id,
          request.query.session_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/publication-records",
      schema: {
        tags: ["publication-records"],
        body: PublicationRecordCreateSchema,
        response: {
          200: PublicationRecordResponseSchema,
          400: ApiErrorResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await createPublicationRecordHandler(request.body);
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "PATCH",
      url: "/publication-records/:publication_record_id",
      schema: {
        tags: ["publication-records"],
        params: z.object({
          publication_record_id: z.number().int().positive(),
        }),
        body: PublicationRecordUpdateSchema,
        response: {
          200: PublicationRecordResponseSchema,
          400: ApiErrorResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await updatePublicationRecordHandler(
          request.params.publication_record_id,
          request.body,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "DELETE",
      url: "/publication-records/:publication_record_id",
      schema: {
        tags: ["publication-records"],
        params: z.object({
          publication_record_id: z.number().int().positive(),
        }),
        querystring: z.object({ session_id: z.uuid() }),
        response: {
          200: ApiResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await deletePublicationRecordHandler(
          request.params.publication_record_id,
          request.query.session_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/participants",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/seminars/:seminar_id/participants",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "GET",
      url: "/seminars/:seminar_id/participants/:participant_id",
      schema: {
        tags: ["participants"],
        params: z.object({
          seminar_id: z.uuid(),
          participant_id: z.number().int().positive(),
        }),
        response: {
          200: ParticipantResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await getParticipantHandler(
          request.params.seminar_id,
          request.params.participant_id,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "POST",
      url: "/seminars/:seminar_id/participants",
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

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "PATCH",
      url: "/seminars/:seminar_id/participants/:participant_id",
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
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await updateParticipantHandler(
          request.params.seminar_id,
          request.params.participant_id,
          request.body,
        );
      },
    });

    app.withTypeProvider<ZodTypeProvider>().route({
      method: "DELETE",
      url: "/seminars/:seminar_id/participants/:participant_id",
      schema: {
        tags: ["participants"],
        params: z.object({
          seminar_id: z.uuid(),
          participant_id: z.number().int().positive(),
        }),
        response: {
          200: ApiResponseSchema,
          401: ApiErrorResponseSchema,
          500: ApiErrorResponseSchema,
        },
      },
      handler: async (request, _reply) => {
        return await deleteParticipantHandler(
          request.params.seminar_id,
          request.params.participant_id,
        );
      },
    });
  });

  app.ready().then(() => {
    app.log.info("server is ready. spawning background thread...");

    const worker = new Worker(
      path.resolve(import.meta.dirname, "db-cleaner.js"),
      {
        workerData: buildDbCleanerWorkerData(env.DATABASE_URL),
      },
    );

    worker.on("error", (err) => {
      app.log.error(err, "Background worker encountered an error");
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        app.log.error(`Background worker exited with code ${code}`);
      } else {
        app.log.info("Background worker exited successfully");
      }
    });
  });

  return app;
};
