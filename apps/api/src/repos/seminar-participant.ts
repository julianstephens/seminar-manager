import type { Database } from "db";
import type { Kysely } from "kysely";

export const createSeminarParticipant = async (
  db: Kysely<Database>,
  values: {
    seminar_id: string;
    participant_id: number;
  },
) => {
  const row = await db
    .insertInto("seminar_participant")
    .values(values)
    .returningAll()
    .executeTakeFirst();

  return row ?? null;
};

export const getSeminarParticipantById = async (
  db: Kysely<Database>,
  id: number,
) => {
  return (
    (await db
      .selectFrom("seminar_participant")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) ?? null
  );
};

export const getSeminarParticipants = async (
  db: Kysely<Database>,
  seminarId: string,
) => {
  return await db
    .selectFrom("seminar_participant")
    .selectAll()
    .where("seminar_id", "=", seminarId)
    .execute();
};

export const getParticipantSeminars = async (
  db: Kysely<Database>,
  participantId: number,
) => {
  return await db
    .selectFrom("seminar_participant")
    .selectAll()
    .where("participant_id", "=", participantId)
    .execute();
};

export const getSeminarParticipantByPair = async (
  db: Kysely<Database>,
  seminarId: string,
  participantId: number,
) => {
  return (
    (await db
      .selectFrom("seminar_participant")
      .selectAll()
      .where("seminar_id", "=", seminarId)
      .where("participant_id", "=", participantId)
      .executeTakeFirst()) ?? null
  );
};

export const deleteSeminarParticipant = async (
  db: Kysely<Database>,
  id: number,
) => {
  await db.deleteFrom("seminar_participant").where("id", "=", id).execute();
};

export const deleteSeminarParticipantsBySeminar = async (
  db: Kysely<Database>,
  seminarId: string,
) => {
  await db
    .deleteFrom("seminar_participant")
    .where("seminar_id", "=", seminarId)
    .execute();
};

export const deleteSeminarParticipantsByParticipant = async (
  db: Kysely<Database>,
  participantId: number,
) => {
  await db
    .deleteFrom("seminar_participant")
    .where("participant_id", "=", participantId)
    .execute();
};
