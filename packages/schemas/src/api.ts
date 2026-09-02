import { z } from "zod";

export const LoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof LoginSchema>;

export const LoginResponseSchema = z.object({
  access_token: z.string().min(1, "Access token is required"),
  expires_in: z.number().min(1, "Expiration time is required"),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
