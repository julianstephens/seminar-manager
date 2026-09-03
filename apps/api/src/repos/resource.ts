import type { Database } from "db";
import type { Kysely } from "kysely";

export const createResource = async (
  db: Kysely<Database>,
  values: {
    session_id: string;
    name: string;
    url: string;
    visibility?: "public" | "private";
  },
) => {
  const resource = await db
    .insertInto("resource")
    .values({
      ...values,
      visibility: values.visibility ?? "private",
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst();

  return resource ?? null;
};

export const getResourceById = async (db: Kysely<Database>, id: string) => {
  return (
    (await db
      .selectFrom("resource")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()) ?? null
  );
};

export const getResourcesBySession = async (
  db: Kysely<Database>,
  sessionId: string,
) => {
  return await db
    .selectFrom("resource")
    .selectAll()
    .where("session_id", "=", sessionId)
    .execute();
};

export const updateResource = async (
  db: Kysely<Database>,
  id: string,
  values: Partial<{
    session_id: string;
    name: string;
    url: string;
    visibility: "public" | "private";
  }>,
) => {
  return (
    (await db
      .updateTable("resource")
      .set(values)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()) ?? null
  );
};

export const deleteResource = async (db: Kysely<Database>, id: string) => {
  await db.deleteFrom("resource").where("id", "=", id).execute();
};
