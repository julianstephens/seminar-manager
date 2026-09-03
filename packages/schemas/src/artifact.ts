import { z } from "zod";
import { ApiResponseSchema } from "./api.ts";

const requiredDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid ISO date value",
  });

export const ResourceSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  name: z.string().min(1, "Resource name is required"),
  url: z.url("Resource URL must be a valid URL"),
  visibility: z.enum(["public", "private"]),
  created_at: requiredDate,
  updated_at: requiredDate,
});
export type Resource = z.infer<typeof ResourceSchema>;

export const ResourceResponseSchema = ApiResponseSchema.extend({
  data: ResourceSchema,
});
export type ResourceResponse = z.infer<typeof ResourceResponseSchema>;

export const ResourceCreateSchema = z.object({
  session_id: z.uuid(),
  name: z.string().min(1, "Resource name is required"),
  url: z.url("Resource URL must be a valid URL"),
  visibility: z.enum(["public", "private"]).default("private"),
});
export type ResourceCreate = z.infer<typeof ResourceCreateSchema>;

export const ResourceUpdateSchema = ResourceCreateSchema.partial();
export type ResourceUpdate = z.infer<typeof ResourceUpdateSchema>;

export const AssignmentSchema = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  participant_id: z.number().int().positive(),
  resource_id: z.uuid(),
  created_at: requiredDate,
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export const AssignmentResponseSchema = ApiResponseSchema.extend({
  data: AssignmentSchema,
});
export type AssignmentResponse = z.infer<typeof AssignmentResponseSchema>;

export const AssignmentCreateSchema = z.object({
  session_id: z.uuid(),
  participant_id: z.number().int().positive(),
  resource_id: z.uuid(),
});
export type AssignmentCreate = z.infer<typeof AssignmentCreateSchema>;

export const SeminarParticipantSchema = z.object({
  id: z.number().int().positive(),
  seminar_id: z.uuid(),
  participant_id: z.number().int().positive(),
});
export type SeminarParticipant = z.infer<typeof SeminarParticipantSchema>;

export const SeminarParticipantCreateSchema = z.object({
  seminar_id: z.uuid(),
  participant_id: z.number().int().positive(),
});
export type SeminarParticipantCreate = z.infer<
  typeof SeminarParticipantCreateSchema
>;

export const PublicationRecordSchema = z.object({
  id: z.number().int().positive(),
  session_id: z.uuid(),
  action: z.enum(["created", "updated", "deleted"]),
  participant_id: z.number().int().positive(),
  external_id: z.string().min(1, "External ID is required"),
  status: z.enum(["pending", "success", "failed"]),
  error: z.string().nullable(),
  created_at: requiredDate,
});
export type PublicationRecord = z.infer<typeof PublicationRecordSchema>;

export const PublicationRecordResponseSchema = ApiResponseSchema.extend({
  data: PublicationRecordSchema,
});
export type PublicationRecordResponse = z.infer<
  typeof PublicationRecordResponseSchema
>;

export const PublicationRecordCreateSchema = z.object({
  session_id: z.uuid(),
  action: z.enum(["created", "updated", "deleted"]),
  participant_id: z.number().int().positive(),
  external_id: z.string().min(1, "External ID is required"),
  status: z.enum(["pending", "success", "failed"]).default("pending"),
  error: z.string().optional().nullable(),
});
export type PublicationRecordCreate = z.infer<
  typeof PublicationRecordCreateSchema
>;

export const PublicationRecordUpdateSchema =
  PublicationRecordCreateSchema.partial();
export type PublicationRecordUpdate = z.infer<
  typeof PublicationRecordUpdateSchema
>;
