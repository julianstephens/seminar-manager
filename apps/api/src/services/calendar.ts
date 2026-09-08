type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  description: string;
};

const calendarDate = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[,;]/g, "\\$&");

// RFC 5545 folds content lines at 75 octets without splitting UTF-8 characters.
const foldLine = (line: string) => {
  let result = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += size;
  }
  return result;
};

export const createCalendar = (event: CalendarEvent) => {
  const start = calendarDate(event.start);
  const end = calendarDate(new Date(event.start.getTime() + 60 * 60 * 1_000));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description,
  });
  const ics =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Seminar Manager//Calendar//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${escapeText(event.id)}@seminar-manager`,
      `DTSTAMP:${calendarDate(new Date())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n";
  return {
    googleUrl: `https://calendar.google.com/calendar/render?${params}`,
    ics,
  };
};
