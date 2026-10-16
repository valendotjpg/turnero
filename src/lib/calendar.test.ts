import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "./calendar";

const event: CalendarEvent = {
  uid: "turno-1@turnero",
  title: "Corte de pelo en Barbería Demo",
  start: new Date("2026-10-20T12:30:00Z"),
  end: new Date("2026-10-20T13:00:00Z"),
  location: "Av. Siempreviva 742, CABA",
  description: "Línea 1\nLínea 2; con punto y coma",
};
const NOW = new Date("2026-10-16T10:00:00Z");

describe("buildIcs", () => {
  const ics = buildIcs(event, NOW);
  const lines = ics.split("\r\n");

  it("arma un VCALENDAR con un VEVENT y fechas en UTC", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("UID:turno-1@turnero");
    expect(lines).toContain("DTSTAMP:20261016T100000Z");
    expect(lines).toContain("DTSTART:20261020T123000Z");
    expect(lines).toContain("DTEND:20261020T130000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("usa CRLF como fin de línea, como pide el estándar", () => {
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("escapa comas, punto y coma y saltos de línea", () => {
    expect(ics).toContain("LOCATION:Av. Siempreviva 742\\, CABA");
    expect(ics).toContain("DESCRIPTION:Línea 1\\nLínea 2\\; con punto y coma");
  });

  it("corta las líneas a 75 octetos, contando bien los caracteres multibyte", () => {
    const long = buildIcs({ ...event, title: "Coloración ".repeat(20) }, NOW);
    const encoder = new TextEncoder();
    for (const line of long.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Al desplegar las líneas de continuación se recupera el texto original.
    expect(long.replace(/\r\n /g, "")).toContain(`SUMMARY:${"Coloración ".repeat(20)}`);
  });

  it("omite los campos opcionales vacíos", () => {
    const minimal = buildIcs({ ...event, location: null, description: undefined }, NOW);
    expect(minimal).not.toContain("LOCATION");
    expect(minimal).not.toContain("DESCRIPTION");
  });
});

describe("googleCalendarUrl", () => {
  it("precarga título, fechas y lugar", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("dates")).toBe("20261020T123000Z/20261020T130000Z");
    expect(url.searchParams.get("location")).toBe(event.location);
  });
});
