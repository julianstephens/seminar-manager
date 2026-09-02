import type { Generated } from "kysely";

export interface User {
  id: Generated<number>;
  name: string;
  password_hash: string;
}

export interface AuthSession {
  id: Generated<string>;
  user_id: number;
  client_fingerprint: string;
  access_token_hash: string;
  expires_at: bigint | number;
  status: "active" | "revoked";
}

export interface SeminarTable {
  id: Generated<number>;
}

export interface Database {
  user: User;
  auth_session: AuthSession;
  seminar: SeminarTable;
}
