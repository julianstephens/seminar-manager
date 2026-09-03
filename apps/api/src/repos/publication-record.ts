import type { Database } from "db";
import type { Kysely } from "kysely";

export const createPublicationRecord = async (
  db: Kysely<Database>,
  values: {
    session_id: string;
    action: "created" | "updated" | "deleted";
    participant_id: number;
    external_id: string;
    status?: "pending" | "success" | "failed";
    error?: string | null;
  },
) => {
  const record = await db
    .insertInto("publication_record")
    .values({
      ...values,
      status: values.status ?? "pending",
    })
    .returningAll()
    .executeTakeFirst();

  return record ?? null;
};

export const getPublicationRecordById = async (
  db: Kysely<Database>,
  id: number,
) => {
  return (
    (await db
      .selectFrom("publication_record")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) ?? null
  );
};

export const getPublicationRecordsBySession = async (
  db: Kysely<Database>,
  sessionId: string,
) => {
  return await db
    .selectFrom("publication_record")
    .selectAll()
    .where("session_id", "=", sessionId)
    .orderBy("created_at", "desc")
    .execute();
};

export const getPublicationRecordsByParticipant = async (
  db: Kysely<Database>,
  participantId: number,
) => {
  return await db
    .selectFrom("publication_record")
    .selectAll()
    .where("participant_id", "=", participantId)
    .orderBy("created_at", "desc")
    .execute();
};

export const updatePublicationRecord = async (
  db: Kysely<Database>,
  id: number,
  values: Partial<{
    session_id: string;
    action: "created" | "updated" | "deleted";
    participant_id: number;
    external_id: string;
    status: "pending" | "success" | "failed";
    error: string | null;
  }>,
) => {
  return (
    (await db
      .updateTable("publication_record")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()) ?? null
  );
};

export const deletePublicationRecord = async (
  db: Kysely<Database>,
  id: number,
) => {
  await db.deleteFrom("publication_record").where("id", "=", id).execute();
};
