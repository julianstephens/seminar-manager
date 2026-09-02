import { type Kysely, sql } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema
    .createType("auth_session_status_enum")
    .asEnum(["active", "revoked"])
    .execute();
  await db.schema
    .createTable("user")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("password_hash", "text", (col) => col.notNull())
    .execute();
  await db.schema
    .createTable("auth_session")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "integer", (col) =>
      col.notNull().references("user.id"),
    )
    .addColumn("client_fingerprint", "text", (col) => col.notNull())
    .addColumn("access_token_hash", "text", (col) => col.notNull())
    .addColumn("expires_at", "bigint", (col) => col.notNull())
    .addColumn("status", sql`auth_session_status_enum`, (col) => col.notNull())
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema.dropTable("auth_session").execute();
  await db.schema.dropType("auth_session_status_enum").execute();
}
