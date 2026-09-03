import type { Database } from "db";
import type { Kysely } from "kysely";

import { withUpdatedAt } from "./timestamps";

export const createResource = async (
  db: Kysely<Database>,
  values: {
    session_id: string;
    name: string;
    url: string;
    visibility?: "shared" | "individual";
  },
) => {
  const resource = await db
    .insertInto("resource")
    .values(
      withUpdatedAt({
        ...values,
        visibility: values.visibility ?? "individual",
      }),
    )
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
    visibility: "shared" | "individual";
  }>,
) => {
  return (
    (await db
      .updateTable("resource")
      .set(withUpdatedAt(values))
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst()) ?? null
  );
};

export const deleteResource = async (db: Kysely<Database>, id: string) => {
  await db.deleteFrom("resource").where("id", "=", id).execute();
};
