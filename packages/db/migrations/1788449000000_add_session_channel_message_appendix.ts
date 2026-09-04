import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("session")
    .addColumn("channel_message_appendix", "text")
    .execute();
}

// `any` is required here since migrations should be frozen in time.
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("session")
    .dropColumn("channel_message_appendix")
    .execute();
}
