import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TYPE publication_record_action_enum ADD VALUE IF NOT EXISTS 'scheduled_event'`.execute(
    db,
  );
}
