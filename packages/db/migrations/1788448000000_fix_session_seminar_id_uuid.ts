import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // The initial session migration now creates the correct UUID foreign key.
  void db;
}

export async function down(db: Kysely<any>): Promise<void> {
  void db;
}
