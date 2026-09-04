import { z } from "zod";
import { ApiResponseSchema } from "./index.ts";

const isoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid ISO date value",
  });

const nullableDate = isoDateString.nullable();
const requiredDate = isoDateString;

export const SeminarSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, "Seminar name is required"),
  description: z.string().nullable(),
  discord_channel_id: z.string().min(1, "Discord channel ID is required"),
  drive_folder_id: z.string().nullable(),
  created_at: requiredDate,
  updated_at: requiredDate,
});
export type Seminar = z.infer<typeof SeminarSchema>;

export const SeminarResponseSchema = ApiResponseSchema.extend({
  data: SeminarSchema,
});
export type SeminarResponse = z.infer<typeof SeminarResponseSchema>;

export const SeminarCreateSchema = z.object({
  name: z.string().min(1, "Seminar name is required"),
  description: z.string().optional().nullable(),
  discord_channel_id: z.string().min(1, "Discord channel ID is required"),
  drive_folder_id: z.string().optional().nullable(),
});
export type SeminarCreate = z.infer<typeof SeminarCreateSchema>;

export const SeminarUpdateSchema = SeminarCreateSchema.partial();
export type SeminarUpdate = z.infer<typeof SeminarUpdateSchema>;

export const SessionSchema = z.object({
  id: z.uuid(),
  seminar_id: z.uuid(),
  session_number: z.number().int().positive(),
  title: z.string().min(1, "Session title is required"),
  date: requiredDate,
  status: z.enum(["draft", "ready", "published", "archived"]),
  drive_folder_id: z.string().nullable(),
  channel_message_appendix: z.string().nullable(),
  published_at: nullableDate,
  archived_at: nullableDate,
  created_at: requiredDate,
  updated_at: requiredDate,
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionResponseSchema = ApiResponseSchema.extend({
  data: SessionSchema,
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const SessionCreateSchema = z.object({
  seminar_id: z.uuid(),
  session_number: z.number().int().positive(),
  title: z.string().min(1, "Session title is required"),
  date: isoDateString,
  drive_folder_id: z.string().optional().nullable(),
  channel_message_appendix: z.string().max(2_000).optional().nullable(),
  published_at: isoDateString.optional().nullable(),
  archived_at: isoDateString.optional().nullable(),
});
export type SessionCreate = z.infer<typeof SessionCreateSchema>;

export const SessionUpdateSchema = SessionCreateSchema.partial();
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>;

export const ParticipantSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1, "Participant name is required"),
  discord_user_id: z.string().min(1, "Discord user ID is required"),
  created_at: requiredDate,
  updated_at: requiredDate,
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const ParticipantResponseSchema = ApiResponseSchema.extend({
  data: ParticipantSchema,
});
export type ParticipantResponse = z.infer<typeof ParticipantResponseSchema>;

export const ParticipantCreateSchema = z.object({
  name: z.string().min(1, "Participant name is required"),
  discord_user_id: z.string().min(1, "Discord user ID is required"),
});
export type ParticipantCreate = z.infer<typeof ParticipantCreateSchema>;

export const ParticipantUpdateSchema = ParticipantCreateSchema.partial();
export type ParticipantUpdate = z.infer<typeof ParticipantUpdateSchema>;
