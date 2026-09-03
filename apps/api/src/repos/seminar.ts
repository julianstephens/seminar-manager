import type { Database } from "db";
import type { Kysely } from "kysely";

import { deleteSeminarParticipantsBySeminar } from "./seminar-participant";
import { withUpdatedAt } from "./timestamps";

export const createSeminar = async (
  db: Kysely<Database>,
  values: {
    name: string;
    description?: string | null;
    discord_channel_id: string;
    drive_folder_id?: string | null;
  },
) => {
  const seminar = await db
    .insertInto("seminar")
    .values(
      withUpdatedAt({
        ...values,
      }),
    )
    .returningAll()
    .executeTakeFirst();

  return seminar ?? null;
};

export const getSeminarById = async (db: Kysely<Database>, id: string) => {
  return (
    (await db
      .selectFrom("seminar")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) ?? null
  );
};

export const getSeminarByName = async (db: Kysely<Database>, name: string) => {
  return (
    (await db
      .selectFrom("seminar")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst()) ?? null
  );
};

export const getSeminars = async (db: Kysely<Database>) => {
  return await db.selectFrom("seminar").selectAll().execute();
};

export const updateSeminar = async (
  db: Kysely<Database>,
  id: string,
  values: Partial<{
    name: string;
    description: string | null;
    discord_channel_id: string;
    drive_folder_id: string | null;
  }>,
) => {
  return (
    (await db
      .updateTable("seminar")
      .set(withUpdatedAt(values))
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()) ?? null
  );
};

export const deleteSeminar = async (db: Kysely<Database>, id: string) => {
  await deleteSeminarParticipantsBySeminar(db, id);
  await db.deleteFrom("seminar").where("id", "=", id).execute();
};
