import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.executeQuery(
    sql`
    ALTER TABLE seminar_participant
    ALTER COLUMN participant_id TYPE integer
    USING participant_id::integer;
  `.compile(db),
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.executeQuery(
    sql`
    ALTER TABLE seminar_participant
    ALTER COLUMN participant_id TYPE uuid
    USING participant_id::text::uuid;
  `.compile(db),
  );
}
