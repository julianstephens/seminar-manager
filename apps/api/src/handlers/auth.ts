import db from "@/db";
import { env } from "@/env";
import { ApiError } from "@/handlers";
import {
  createAuthSession,
  createUser,
  getAuthSession,
  getSessionByUserAndClient,
  getUserByName,
  getUserSessions,
  hashPassword,
  revokeAuthSession,
} from "@/repos/auth";
import type { LoginRequest, LoginResponse } from "schemas";

export class InvalidSessionError extends ApiError {
  constructor(message = "Invalid session") {
    super(401, message);
    this.name = "InvalidSessionError";
  }
}

export class InvalidCredentialsError extends ApiError {
  constructor(message = "Invalid password") {
    super(401, message);
    this.name = "InvalidCredentialsError";
  }
}

export type LoginAction =
  | "create-user-and-session"
  | "invalid-password"
  | "revoke-and-create-session"
  | "create-session";

export const extractBearerToken = (
  authorizationHeader?: string | string[] | undefined,
): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const header = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;

  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ? match[1].trim() : null;
};

export const resolveLoginAction = ({
  user,
  passwordHash,
  clientFingerprint,
  sessions,
}: {
  user: { id: number; name: string; password_hash: string } | null;
  passwordHash: string;
  clientFingerprint: string;
  sessions: Array<{
    id: string;
    user_id: number;
    client_fingerprint: string;
    status: "active" | "revoked";
  }>;
}): LoginAction => {
  if (!user) {
    return "create-user-and-session";
  }

  if (user.password_hash !== passwordHash) {
    return "invalid-password";
  }

  const existingSession = sessions.find(
    (session) =>
      session.client_fingerprint === clientFingerprint &&
      session.status === "active",
  );

  return existingSession ? "revoke-and-create-session" : "create-session";
};

export const loginHandler = async (
  req: LoginRequest,
): Promise<LoginResponse> => {
  if (!req.password) {
    throw new ApiError(400, "Password is required");
  }

  if (!req.client_fingerprint) {
    throw new ApiError(400, "Client fingerprint is required");
  }

  const passwordHash = hashPassword(env.ADMIN_PASSWORD);
  const existingUser = await getUserByName(db, "admin");
  const existingSessions = existingUser
    ? await getUserSessions(db, existingUser.id)
    : [];

  if (req.password !== env.ADMIN_PASSWORD) {
    throw new InvalidCredentialsError("Invalid password");
  }

  const action = resolveLoginAction({
    user: existingUser
      ? { ...existingUser, password_hash: passwordHash }
      : null,
    passwordHash,
    clientFingerprint: req.client_fingerprint,
    sessions: existingSessions,
  });

  const user =
    existingUser ?? (await createUser(db, "admin", env.ADMIN_PASSWORD));

  if (!user) {
    throw new ApiError(500, "Unable to create user");
  }

  if (action === "revoke-and-create-session") {
    const existingClientSession = await getSessionByUserAndClient(
      db,
      user.id,
      req.client_fingerprint,
    );

    if (existingClientSession) {
      await revokeAuthSession(db, existingClientSession.id);
    }
  }

  return await createAuthSession(db, user.id, req.client_fingerprint);
};

export const logoutHandler = async (access_token: string) => {
  const session = await getAuthSession(db, access_token);
  if (!session) {
    throw new InvalidSessionError("Invalid session");
  }

  await revokeAuthSession(db, session.id);
};
