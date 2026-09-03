import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.executeQuery(
    sql`
    DELETE FROM session
    WHERE seminar_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  `.compile(db),
  );

  await db.executeQuery(
    sql`
    ALTER TABLE session
    ALTER COLUMN seminar_id TYPE uuid
    USING seminar_id::text::uuid;
  `.compile(db),
  );

  await db.executeQuery(
    sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'session_seminar_id_fkey'
      ) THEN
        ALTER TABLE session
        ADD CONSTRAINT session_seminar_id_fkey
        FOREIGN KEY (seminar_id)
        REFERENCES seminar(id)
        ON DELETE CASCADE;
      END IF;
    END
    $$;
  `.compile(db),
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.executeQuery(
    sql`
    ALTER TABLE session
    DROP CONSTRAINT IF EXISTS session_seminar_id_fkey;
  `.compile(db),
  );

  await db.executeQuery(
    sql`
    ALTER TABLE session
    ALTER COLUMN seminar_id TYPE integer
    USING NULL;
  `.compile(db),
  );
}
