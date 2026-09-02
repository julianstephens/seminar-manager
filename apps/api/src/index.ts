import { env } from "@/env";
import { ApiError, loginHandler, logoutHandler } from "@/handlers/auth";
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
import Fastify from "fastify";
import path from "path";
import {
  ApiErrorResponseSchema,
  LoginResponseSchema,
  LoginSchema,
  LogoutErrorResponseSchema,
  LogoutResponseSchema,
  LogoutSchema,
} from "schemas";
import { Worker } from "worker_threads";

import { buildDbCleanerWorkerData } from "./db-cleaner";
import { toRequestErrorResponse } from "./error-response";

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

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ApiError) {
    return reply
      .code(err.statusCode)
      .send(toRequestErrorResponse(err.statusCode, err.message, req));
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
      body: LogoutSchema,
      response: {
        200: LogoutResponseSchema,
        401: LogoutErrorResponseSchema,
        500: ApiErrorResponseSchema,
      },
    },
    handler: async (request, _reply) => {
      await logoutHandler(request.body.access_token);
      return { success: true, message: "Session revoked successfully." };
    },
  });
});

app.get("/", async (_request, _reply) => {
  return { hello: "world" };
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

const start = async () => {
  try {
    await app.ready();
    await app.listen({ host: "0.0.0.0", port: env.PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
