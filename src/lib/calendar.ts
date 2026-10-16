// Enlaces y archivos para agregar un turno al calendario del cliente.

export interface CalendarEvent {
  /** Identificador estable del evento (el mismo turno, el mismo uid). */
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
  description?: string;
  url?: string;
}

/** 2026-10-20T12:00:00.000Z → 20261020T120000Z */
const icsDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escapa texto según RFC 5545 (barras, comas, punto y coma, saltos de línea). */
const icsText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Corta las líneas largas a 75 octetos, como pide el estándar. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    // Las líneas de continuación empiezan con un espacio, que también cuenta.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Archivo .ics (iCalendar) con un único evento. */
export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turnero//Turnos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
    `SUMMARY:${icsText(event.title)}`,
    event.location && `LOCATION:${icsText(event.location)}`,
    event.description && `DESCRIPTION:${icsText(event.description)}`,
    event.url && `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => Boolean(line));

  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Enlace que abre Google Calendar con el evento precargado. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsDate(event.start)}/${icsDate(event.end)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.description) params.set("details", event.description);
  return `https://calendar.google.com/calendar/render?${params}`;
}
