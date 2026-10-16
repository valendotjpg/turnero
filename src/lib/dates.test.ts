import { describe, expect, it } from "vitest";
import {
  addDays,
  dateRange,
  formatDateLong,
  formatDayMonth,
  formatDuration,
  formatPrice,
  formatTime,
  formatTimeOfDay,
  formatWeekdayShort,
  isCalendarDate,
  localDateOf,
  parseTimeOfDay,
} from "./dates";

const BA = "America/Argentina/Buenos_Aires";

// Intl separa símbolo y número con un espacio irrompible; se normaliza para comparar.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("localDateOf", () => {
  it("devuelve la fecha en la zona del negocio, no en UTC", () => {
    // 01:00 UTC del 21 son las 22:00 del 20 en Buenos Aires.
    expect(localDateOf(new Date("2026-10-21T01:00:00Z"), BA)).toBe("2026-10-20");
    expect(localDateOf(new Date("2026-10-21T03:00:00Z"), BA)).toBe("2026-10-21");
  });

  it("completa con ceros", () => {
    expect(localDateOf(new Date("2026-03-05T15:00:00Z"), BA)).toBe("2026-03-05");
  });
});

describe("addDays", () => {
  it("cruza meses y años", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("no se ve afectada por los cambios de horario de verano", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
  });
});

describe("dateRange", () => {
  it("genera fechas consecutivas incluyendo la inicial", () => {
    expect(dateRange("2026-10-30", 3)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});

describe("formateo", () => {
  it("formatea fechas de calendario sin depender de la zona", () => {
    expect(formatWeekdayShort("2026-10-20")).toBe("mar");
    expect(formatDateLong("2026-10-20")).toBe("martes, 20 de octubre");
    expect(formatDayMonth("2026-10-20")).toBe("20 oct");
  });

  it("formatea horas en 24 h en la zona del negocio", () => {
    expect(formatTime(new Date("2026-10-20T19:30:00Z"), BA)).toBe("16:30");
  });

  it("formatea precios en pesos sin decimales innecesarios", () => {
    expect(plain(formatPrice(1_200_000))).toBe("$ 12.000");
    expect(plain(formatPrice(1_250_050))).toBe("$ 12.500,50");
  });

  it.each([
    [20, "20 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
  ])("formatea %i minutos como %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("horas del día", () => {
  it.each([
    ["00:00", 0],
    ["09:30", 570],
    ["23:59", 1439],
    ["24:00", 1440],
  ])("parsea %s como %i minutos", (value, minutes) => {
    expect(parseTimeOfDay(value)).toBe(minutes);
    expect(formatTimeOfDay(minutes)).toBe(value);
  });

  it.each(["24:01", "25:00", "9:30", "09:60", "0930", ""])("rechaza %j", (value) => {
    expect(parseTimeOfDay(value)).toBeNull();
  });
});

describe("isCalendarDate", () => {
  it("acepta fechas reales y rechaza el resto", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("20-10-2026")).toBe(false);
  });
});
