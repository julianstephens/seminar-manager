export const serializeApiDates = <T>(value: T): T => {
  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeApiDates(item)) as T;
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        serializeApiDates(entry),
      ]),
    ) as T;
  }

  return value;
};
