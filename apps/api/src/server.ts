import db from "@/db";
import { env } from "@/env";
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
  deleteParticipantHandler,
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
} from "@/handlers/seminar";
import type { DiscordService } from "@/integrations/discord/discord-service";
import type { DriveService } from "@/integrations/google-drive/drive-service";
import {
  createParticipant,
  getAssignmentById,
  getParticipantByDiscordUserId,
  getParticipantById,
  getParticipantByName,
  getPublicationRecordById,
  getResourceById,
  getSessionById,
  updateSession,
} from "@/repos";
import { getAuthSession } from "@/repos/auth";
import { getIntegrationStatus } from "@/services/integration-status";
import {
  archiveSession,
  getReadiness,
  getSessionLifecycle,
  prepareSessionDriveFolder,
  publishSession,
  retryPublication,
} from "@/services/publication-service";
import fastifySchedule from "@fastify/schedule";
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
import { Worker } from "node:worker_threads";
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
import { AsyncTask, CronJob } from "toad-scheduler";
import { z } from "zod";
import { buildDbCleanerWorkerData } from "./db-cleaner";
import { toRequestErrorResponse } from "./error-response";

const registerWeeklyDbCleaner = (app: FastifyInstance) => {
  let dbCleanerWorker: Worker | null = null;

  const dbCleanerTask = new AsyncTask(
    "weekly-db-cleaner",
    async () => {
      const worker = new Worker(new URL("./db-cleaner.ts", import.meta.url), {
        workerData: buildDbCleanerWorkerData(env.DATABASE_URL),
      });
      dbCleanerWorker = worker;

      await new Promise<void>((resolve, reject) => {
        worker.once("error", reject);
        worker.once("message", (message) => {
          if (message && typeof message === "object" && "status" in message) {
            resolve();
          }
        });
        worker.once("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`db-cleaner exited with code ${code}`));
          }
        });
      });
    },
    (err) => {
      app.log.error(err, "weekly db cleaner task failed");
    },
  );

  const weeklyDbCleanerJob = new CronJob(
    {
      cronExpression: "0 2 * * 0",
      timezone: "UTC",
    },
    dbCleanerTask,
    {
      preventOverrun: true,
    },
  );

  app.scheduler.addCronJob(weeklyDbCleanerJob);

  app.addHook("onClose", async () => {
    if (dbCleanerWorker) {
      await dbCleanerWorker.terminate();
      dbCleanerWorker = null;
    }
    app.scheduler.stop();
  });
};

export const setupApp = async (options?: {
  discordService?: DiscordService;
  driveService?: DriveService;
}): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySchedule);

  app.addHook("onSend", async (request, reply) => {
    reply.header(
      "Content-Security-Policy",
      env.NODE_ENV !== "production" && request.url.startsWith("/docs")
        ? "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        : "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    reply.header(
      "Permissions-Policy",
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
    }
  });

  if (env.NODE_ENV !== "production") {
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
  }

  app.addHook("preHandler", async (request) => {
    const requestPath = request.url.split("?")[0];
    const publicRoutes = new Set([
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET /api/health",
    ]);
    const isPublicRequest =
      publicRoutes.has(`${request.method} ${requestPath}`) ||
      (env.NODE_ENV !== "production" && requestPath.startsWith("/docs"));

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
          toRequestErrorResponse(
            apiError.statusCode,
            apiError.message,
            req,
            apiError.details,
          ),
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

  registerWeeklyDbCleaner(app);

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "GET",
    url: "/api/health",
    schema: {
      tags: ["health"],
      response: {
        200: z.object({ status: z.literal("ok") }),
      },
    },
    handler: async () => ({ status: "ok" as const }),
  });

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

  const IntegrationStatusSchema = z.object({
    checked_at: z.iso.datetime(),
    discord: z.object({
      status: z.enum(["connected", "error", "not_configured"]),
      label: z.string().optional(),
      message: z.string(),
    }),
    google_drive: z.object({
      status: z.enum(["connected", "error", "not_configured"]),
      label: z.string().optional(),
      message: z.string(),
    }),
  });

  typedApp.route({
    method: "GET",
    url: "/api/integrations/status",
    schema: {
      tags: ["integrations"],
      response: {
        200: IntegrationStatusSchema,
        401: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async () => await getIntegrationStatus(),
  });

  typedApp.route({
    method: "DELETE",
    url: "/api/seminars/:seminar_id/participants/:participant_id",
    schema: {
      tags: ["participants"],
      params: z.object({
        seminar_id: z.uuid(),
        participant_id: z.coerce.number().int().positive(),
      }),
      response: {
        200: z.object({ message: z.string(), data: z.null() }),
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
    handler: async (request) => {
      return await deleteParticipantHandler(
        request.params.seminar_id,
        request.params.participant_id,
      );
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
    url: "/api/sessions/:id/readiness",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: z.object({ ready: z.boolean(), issues: z.string().array() }),
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
    handler: async (request) => {
      const session = await getSessionById(db, request.params.id);
      if (!session) throw new ApiError(404, "Session not found");
      return await getReadiness(db, session);
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

      return sessionPayload(session, await getSessionLifecycle(db, session));
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
      if (request.body.published_at) {
        throw new ApiError(
          400,
          "Use the publish endpoint to publish a session",
        );
      }

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

      return sessionPayload(session, await getSessionLifecycle(db, session));
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

  const PublicationResultSchema = z.object({
    session_id: z.uuid(),
    status: z.enum(["published", "archived"]),
    readiness: z.object({ ready: z.boolean(), issues: z.string().array() }),
    results: z.object({
      drive: z.enum(["success", "failed"]),
      channel_message: z.enum(["success", "failed"]).optional(),
      archive_message: z.enum(["success", "failed"]).optional(),
      participant_dms: z.array(
        z.object({
          participant_id: z.number().int().positive(),
          status: z.enum(["success", "failed"]),
        }),
      ),
    }),
  });

  const DrivePreparationResultSchema = z.object({
    session_id: z.uuid(),
    folder_id: z.string().min(1),
    folder_url: z.url(),
  });

  // POST /api/sessions/:id/prepare-drive
  typedApp.route({
    method: "POST",
    url: "/api/sessions/:id/prepare-drive",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      response: {
        200: DrivePreparationResultSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await prepareSessionDriveFolder(
        db,
        request.params.id,
        options?.driveService,
      );
    },
  });

  // POST /api/sessions/:id/publish
  const PublishSessionBodySchema = z.preprocess(
    (value) => value ?? {},
    z.object({
      message_appendix: z.string().max(2_000).optional(),
      notifications: z
        .object({
          channel_message: z.boolean().optional(),
          participant_dms: z.boolean().optional(),
        })
        .optional(),
    }),
  );

  typedApp.route({
    method: "POST",
    url: "/api/sessions/:id/publish",
    schema: {
      tags: ["sessions"],
      params: z.object({ id: z.uuid() }),
      body: PublishSessionBodySchema,
      response: {
        200: PublicationResultSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await publishSession(
        db,
        request.params.id,
        options?.discordService,
        options?.driveService,
        request.body.message_appendix,
        {
          channelMessage: request.body.notifications?.channel_message,
          participantDms: request.body.notifications?.participant_dms,
        },
      );
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
        200: PublicationResultSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      return await archiveSession(
        db,
        request.params.id,
        options?.discordService,
        options?.driveService,
      );
    },
  });

  typedApp.route({
    method: "POST",
    url: "/api/publications/:id/retry",
    schema: {
      tags: ["publication-records"],
      params: z.object({ id: z.coerce.number().int().positive() }),
      response: {
        200: PublicationRecordResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
      },
    },
    handler: async (request) => {
      const record = await retryPublication(db, request.params.id);
      if (!record) throw new ApiError(500, "Unable to retry publication");
      return await getPublicationRecordHandler(record.id, record.session_id);
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
