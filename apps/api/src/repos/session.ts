import type { Database } from "db";
import type { Kysely } from "kysely";

import { withUpdatedAt } from "./timestamps";

export const createSession = async (
  db: Kysely<Database>,
  values: {
    seminar_id: string;
    session_number: number;
    title: string;
    date: Date;
    status?: "scheduled" | "completed" | "canceled";
    drive_folder_id?: string | null;
    published_at?: Date | null;
    archived_at?: Date | null;
  },
) => {
  const session = await db
    .insertInto("session")
    .values(
      withUpdatedAt({
        ...values,
        status: values.status ?? "scheduled",
      }),
    )
    .returningAll()
    .executeTakeFirst();

  return session ?? null;
};

export const getSessionById = async (db: Kysely<Database>, id: string) => {
  return (
    (await db
      .selectFrom("session")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) ?? null
  );
};

export const getSessionsBySeminar = async (
  db: Kysely<Database>,
  seminarId: string,
) => {
  return await db
    .selectFrom("session")
    .selectAll()
    .where("seminar_id", "=", seminarId)
    .orderBy("session_number", "asc")
    .execute();
};

export const getSessionBySeminarAndNumber = async (
  db: Kysely<Database>,
  seminarId: string,
  sessionNumber: number,
) => {
  return (
    (await db
      .selectFrom("session")
      .selectAll()
      .where("seminar_id", "=", seminarId)
      .where("session_number", "=", sessionNumber)
      .executeTakeFirst()) ?? null
  );
};

export const updateSession = async (
  db: Kysely<Database>,
  id: string,
  values: Partial<{
    seminar_id: string;
    session_number: number;
    title: string;
    date: Date;
    status: "scheduled" | "completed" | "canceled";
    drive_folder_id: string | null;
    published_at: Date | null;
    archived_at: Date | null;
  }>,
) => {
  return (
    (await db
      .updateTable("session")
      .set(withUpdatedAt(values))
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()) ?? null
  );
};

export const deleteSession = async (db: Kysely<Database>, id: string) => {
  await db.deleteFrom("session").where("id", "=", id).execute();
};
