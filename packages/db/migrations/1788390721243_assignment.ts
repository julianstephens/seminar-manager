import { sql, type Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema
    .createTable("assignment")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("session_id", "uuid", (col) =>
      col.notNull().references("session.id").onDelete("cascade"),
    )
    .addColumn("participant_id", "integer", (col) =>
      col.notNull().references("participant.id").onDelete("cascade"),
    )
    .addColumn("resource_id", "uuid", (col) =>
      col.notNull().references("resource.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addUniqueConstraint(
      "assignment_session_id_participant_id_resource_id_unique",
      ["session_id", "participant_id", "resource_id"],
    )
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema.dropTable("assignment").execute();
}
