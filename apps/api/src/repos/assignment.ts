import type { Database } from "db";
import type { Kysely } from "kysely";

export const createAssignment = async (
  db: Kysely<Database>,
  values: {
    session_id: string;
    participant_id: number;
    resource_id: string;
  },
) => {
  const assignment = await db
    .insertInto("assignment")
    .values(values)
    .returningAll()
    .executeTakeFirst();

  return assignment ?? null;
};

export const getAssignmentById = async (db: Kysely<Database>, id: string) => {
  return (
    (await db
      .selectFrom("assignment")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) ?? null
  );
};

export const getAssignmentsBySession = async (
  db: Kysely<Database>,
  sessionId: string,
) => {
  return await db
    .selectFrom("assignment")
    .selectAll()
    .where("session_id", "=", sessionId)
    .execute();
};

export const getAssignmentsByParticipant = async (
  db: Kysely<Database>,
  participantId: number,
) => {
  return await db
    .selectFrom("assignment")
    .selectAll()
    .where("participant_id", "=", participantId)
    .execute();
};

export const getAssignmentBySessionAndParticipant = async (
  db: Kysely<Database>,
  sessionId: string,
  participantId: number,
) => {
  return (
    (await db
      .selectFrom("assignment")
      .selectAll()
      .where("session_id", "=", sessionId)
      .where("participant_id", "=", participantId)
      .executeTakeFirst()) ?? null
  );
};

export const deleteAssignment = async (db: Kysely<Database>, id: string) => {
  await db.deleteFrom("assignment").where("id", "=", id).execute();
};
