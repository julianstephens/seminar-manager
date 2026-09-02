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
import { LoginResponseSchema, LoginSchema } from "schemas";
import { env } from "./env.ts";

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
  if (hasZodFastifySchemaValidationErrors(err)) {
    return reply.code(400).send({
      error: "Response Validation Error",
      message: "Request doesn't match the schema",
      statusCode: 400,
      details: {
        issues: err.validation,
        method: req.method,
        url: req.url,
      },
    });
  }

  if (isResponseSerializationError(err)) {
    return reply.code(500).send({
      error: "Internal Server Error",
      message: "Response doesn't match the schema",
      statusCode: 500,
      details: {
        issues: err.cause.issues,
        method: err.method,
        url: err.url,
      },
    });
  }

  return reply.code(500).send({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
    details: {
      method: req.method,
      url: req.url,
      error: err instanceof Error ? err.message : String(err),
    },
    statusCode: 500,
  });
});

app.after(() => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/auth/login",
    schema: {
      body: LoginSchema,
      response: {
        200: LoginResponseSchema,
      },
    },
    handler: async (_request, _reply) => {
      return { access_token: "your-jwt-token", expires_in: 3600 };
    },
  });
});

app.get("/", async (_request, _reply) => {
  return { hello: "world" };
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
