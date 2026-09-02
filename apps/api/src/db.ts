import type { Database } from "db";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env } from "./env.ts";

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: env.DATABASE_URL,
    }),
  }),
});
