import { sql, type Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema
    .createType("publication_record_action_enum")
    .asEnum(["created", "updated", "deleted"])
    .execute();
  await db.schema
    .createType("publication_record_status_enum")
    .asEnum(["pending", "success", "failed"])
    .execute();
  await db.schema
    .createTable("publication_record")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("session_id", "uuid", (col) => col.notNull())
    .addColumn("action", sql`publication_record_action_enum`, (col) =>
      col.notNull(),
    )
    .addColumn("participant_id", "integer", (col) => col.notNull())
    .addColumn("external_id", "text", (col) => col.notNull())
    .addColumn("status", sql`publication_record_status_enum`, (col) =>
      col.notNull(),
    )
    .addColumn("error", "text")
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema.dropTable("publication_record").execute();
  await db.schema.dropType("publication_record_action_enum").execute();
  await db.schema.dropType("publication_record_status_enum").execute();
}
