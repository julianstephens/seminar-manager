import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default("3000")
    .transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.url(),
  DISCORD_BOT_TOKEN: z.string(),
  DISCORD_GUILD_ID: z.string(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().optional(),
  SESSION_SECRET: z.string(),
  ADMIN_PASSWORD: z.string().min(1),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables:");
  console.error(JSON.stringify(_env.error.issues, null, 2));
  process.exit(1);
}

export const env = _env.data;
