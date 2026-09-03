import type { Database } from "db";
import type { Kysely } from "kysely";

import { deleteSeminarParticipantsByParticipant } from "./seminar-participant";

export const createParticipant = async (
  db: Kysely<Database>,
  values: {
    name: string;
    discord_user_id: string;
  },
) => {
  const participant = await db
    .insertInto("participant")
    .values({
      ...values,
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst();

  return participant ?? null;
};

export const getParticipantById = async (db: Kysely<Database>, id: number) => {
  return (
    (await db
      .selectFrom("participant")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) ?? null
  );
};

export const getParticipantByDiscordUserId = async (
  db: Kysely<Database>,
  discordUserId: string,
) => {
  return (
    (await db
      .selectFrom("participant")
      .selectAll()
      .where("discord_user_id", "=", discordUserId)
      .executeTakeFirst()) ?? null
  );
};

export const getParticipants = async (db: Kysely<Database>) => {
  return await db.selectFrom("participant").selectAll().execute();
};

export const updateParticipant = async (
  db: Kysely<Database>,
  id: number,
  values: Partial<{
    name: string;
    discord_user_id: string;
  }>,
) => {
  return (
    (await db
      .updateTable("participant")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()) ?? null
  );
};

export const deleteParticipant = async (db: Kysely<Database>, id: number) => {
  await deleteSeminarParticipantsByParticipant(db, id);
  await db.deleteFrom("participant").where("id", "=", id).execute();
};
