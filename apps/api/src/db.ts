import type { Database } from "db";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { env } from "./env.ts";

const _db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: env.DATABASE_URL,
    }),
  }),
});

export default _db;
