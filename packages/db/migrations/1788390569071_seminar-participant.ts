import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // up migration code goes here...
  // note: up migrations are mandatory. you must implement this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema
    .createTable("seminar_participant")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("seminar_id", "uuid", (col) =>
      col.notNull().references("seminar.id").onDelete("cascade"),
    )
    .addColumn("participant_id", "integer", (col) =>
      col.notNull().references("participant.id").onDelete("cascade"),
    )
    .addUniqueConstraint("seminar_participant_unique", [
      "seminar_id",
      "participant_id",
    ])
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // down migration code goes here...
  // note: down migrations are optional. you can safely delete this function.
  // For more info, see: https://kysely.dev/docs/migrations
  await db.schema.dropTable("seminar_participant").execute();
}
