import crypto from "crypto";
import type { Database } from "db";
import type { Kysely } from "kysely";
import type { LoginResponse } from "schemas";

// const DEFAULT_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days
const DEFAULT_EXPIRES_IN = 60 * 7; // 7 min

export const hashPassword = (password: string) =>
  crypto.createHash("sha256").update(password).digest("hex");

export const createUser = async (
  db: Kysely<Database>,
  name: string,
  password: string,
) => {
  const password_hash = hashPassword(password);

  const user = await db
    .insertInto("user")
    .values({ name, password_hash })
    .returningAll()
    .executeTakeFirst();

  return user ?? null;
};

export const getUserByName = async (db: Kysely<Database>, name: string) => {
  return (
    (await db
      .selectFrom("user")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst()) ?? null
  );
};

export const getUserSessions = async (db: Kysely<Database>, userId: number) => {
  return await db
    .selectFrom("auth_session")
    .selectAll()
    .where("user_id", "=", userId)
    .execute();
};

export const getSessionByUserAndClient = async (
  db: Kysely<Database>,
  userId: number,
  clientFingerprint: string,
) => {
  return (
    (await db
      .selectFrom("auth_session")
      .selectAll()
      .where("user_id", "=", userId)
      .where("client_fingerprint", "=", clientFingerprint)
      .where("status", "=", "active")
      .executeTakeFirst()) ?? null
  );
};

export const createAuthSession = async (
  db: Kysely<Database>,
  userId: number,
  clientFingerprint: string,
): Promise<LoginResponse> => {
  const access_token = crypto.randomBytes(32).toString("hex");
  const access_token_hash = crypto
    .createHash("sha256")
    .update(access_token)
    .digest("hex");

  await db
    .insertInto("auth_session")
    .values({
      user_id: userId,
      client_fingerprint: clientFingerprint,
      access_token_hash,
      expires_at: Math.floor(Date.now() / 1000) + DEFAULT_EXPIRES_IN,
      status: "active",
    })
    .execute();

  return {
    access_token,
    expires_in: DEFAULT_EXPIRES_IN,
  };
};

export const revokeAuthSession = async (db: Kysely<Database>, id: string) => {
  await db
    .updateTable("auth_session")
    .set({ status: "revoked" })
    .where("id", "=", id)
    .execute();
};

export const getAuthSession = async (
  db: Kysely<Database>,
  access_token: string,
) => {
  const access_token_hash = crypto
    .createHash("sha256")
    .update(access_token)
    .digest("hex");

  const session = await db
    .selectFrom("auth_session")
    .selectAll()
    .where("access_token_hash", "=", access_token_hash)
    .executeTakeFirst();

  return session ?? null;
};

export const getAuthSessionByUser = async (
  db: Kysely<Database>,
  userId: number,
) => {
  const session = await db
    .selectFrom("auth_session")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();

  return session ?? null;
};

export const deleteAuthSession = async (db: Kysely<Database>, id: string) => {
  await db.deleteFrom("auth_session").where("id", "=", id).execute();
};
