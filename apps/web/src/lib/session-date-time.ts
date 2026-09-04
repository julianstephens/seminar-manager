export const toDateTimeInputValue = (isoValue: string) => {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

export const fromDateTimeInputValue = (dateTimeValue: string) => {
  const parsed = new Date(dateTimeValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
