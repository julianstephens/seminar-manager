import db from "@/db";
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

  const passwordHash = hashPassword(req.password);
  const existingUser = await getUserByName(db, "admin");
  const existingSessions = existingUser
    ? await getUserSessions(db, existingUser.id)
    : [];

  const action = resolveLoginAction({
    user: existingUser,
    passwordHash,
    clientFingerprint: req.client_fingerprint,
    sessions: existingSessions,
  });

  if (action === "invalid-password") {
    throw new InvalidCredentialsError("Invalid password");
  }

  const user = existingUser ?? (await createUser(db, "admin", req.password));

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
