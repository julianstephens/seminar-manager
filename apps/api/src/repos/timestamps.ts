export const withUpdatedAt = <T extends Record<string, unknown>>(
  values: T,
) => ({
  ...values,
  updated_at: new Date(),
});
