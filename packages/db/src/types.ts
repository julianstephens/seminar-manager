import type { Generated } from "kysely";

export interface UserTable {
  id: Generated<number>;
  name: string;
  password_hash: string;
}

export interface AuthSessionTable {
  id: Generated<string>;
  user_id: number;
  client_fingerprint: string;
  access_token_hash: string;
  expires_at: Date;
  status: "active" | "revoked";
  created_at: Generated<Date>;
}

export interface SeminarTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  discord_channel_id: string;
  drive_folder_id: string | null;
  created_at: Generated<Date>;
  updated_at: Date;
}

export interface SessionTable {
  id: Generated<string>;
  seminar_id: string;
  session_number: number;
  title: string;
  date: Date;
  drive_folder_id: string | null;
  published_at: Date | null;
  archived_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Date;
}

export interface ParticipantTable {
  id: Generated<number>;
  name: string;
  discord_user_id: string;
  created_at: Generated<Date>;
  updated_at: Date;
}

export interface SeminarParticipantTable {
  id: Generated<number>;
  seminar_id: string;
  participant_id: number;
}

export interface ResourceTable {
  id: Generated<string>;
  session_id: string;
  name: string;
  url: string;
  visibility: "shared" | "individual";
  created_at: Generated<Date>;
  updated_at: Date;
}

export interface AssignmentTable {
  id: Generated<string>;
  session_id: string;
  participant_id: number;
  resource_id: string;
  created_at: Generated<Date>;
}

export interface PublicationRecordTable {
  id: Generated<number>;
  session_id: string;
  action:
    "channel_message" | "participant_dm" | "drive_setup" | "archive_message";
  participant_id: number | null;
  external_id: string | null;
  status: "success" | "failed";
  error: string | null;
  created_at: Generated<Date>;
}

export interface Database {
  user: UserTable;
  auth_session: AuthSessionTable;
  seminar: SeminarTable;
  session: SessionTable;
  participant: ParticipantTable;
  seminar_participant: SeminarParticipantTable;
  resource: ResourceTable;
  assignment: AssignmentTable;
  publication_record: PublicationRecordTable;
}
