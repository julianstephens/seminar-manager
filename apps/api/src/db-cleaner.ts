import type { Database } from "db";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { parentPort, workerData } from "worker_threads";

export const buildDbCleanerWorkerData = (databaseUrl: string) => ({
  databaseUrl,
});

const cleanRevokedAuthSessions = async (db: Kysely<Database>) => {
  const revokedSessions = await db
    .selectFrom("auth_session")
    .selectAll()
    .where("status", "=", "revoked")
    .execute();

  for (const session of revokedSessions) {
    try {
      await db
        .deleteFrom("auth_session")
        .where("id", "=", session.id)
        .execute();
    } catch (error) {
      console.error(
        { err: error },
        `failed to delete revoked session with id ${session.id}:`,
      );
    }
  }
};

const run = async () => {
  if (!parentPort || !workerData || typeof workerData !== "object") {
    return;
  }

  const { databaseUrl } = workerData as { databaseUrl?: string };

  if (!databaseUrl) {
    return;
  }

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
      }),
    }),
  });

  await cleanRevokedAuthSessions(db);
  await db.destroy();
  parentPort.postMessage({ status: "done" });
};

void run();
