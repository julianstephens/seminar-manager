import { z } from "zod";
import { ApiErrorResponseSchema, type ApiErrorResponse } from "./api.ts";

export const LoginSchema = z.object({
  client_fingerprint: z.string().min(1, "Client fingerprint is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof LoginSchema>;

export const LoginResponseSchema = z.object({
  access_token: z.string().min(1, "Access token is required"),
  expires_in: z.number().min(1, "Expiration time is required"),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const LogoutSchema = z.object({
  access_token: z.string().min(1, "Access token is required"),
});
export type LogoutRequest = z.infer<typeof LogoutSchema>;

export const LogoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

export const LogoutErrorResponseSchema = ApiErrorResponseSchema;
export type LogoutErrorResponse = ApiErrorResponse;
