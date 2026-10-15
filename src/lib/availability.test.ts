import { describe, expect, it } from "vitest";
import {
  dayBounds,
  getAvailableSlots,
  weekdayOf,
  type AvailabilityInput,
  type WorkingWindow,
} from "./availability";

// Buenos Aires no tiene horario de verano: UTC-3 todo el año.
const BA = "America/Argentina/Buenos_Aires";
const TUESDAY = "2026-10-20";

/** Instante de TUESDAY a la hora local `hhmm` de Buenos Aires. */
const at = (hhmm: string) => new Date(`${TUESDAY}T${hhmm}:00-03:00`);

const hours = (from: string, to: string, weekday = 2): WorkingWindow => {
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  return { weekday, startMinute: minutes(from), endMinute: minutes(to) };
};

/** Arma una consulta con valores por defecto razonables. */
const query = (overrides: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  date: TUESDAY,
  timezone: BA,
  workingHours: [hours("09:00", "10:00")],
  busy: [],
  durationMinutes: 30,
  now: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

/** Inicio de cada horario disponible, en hora local de Buenos Aires. */
const startTimes = (input: AvailabilityInput) =>
  getAvailableSlots(input).map(({ start }) =>
    start.toLocaleTimeString("es-AR", {
      timeZone: BA,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
  );

describe("getAvailableSlots", () => {
  describe("franjas de atención", () => {
    it("ofrece horarios cada 15 minutos por defecto", () => {
      expect(startTimes(query())).toEqual(["09:00", "09:15", "09:30"]);
    });

    it("respeta un paso personalizado", () => {
      expect(startTimes(query({ stepMinutes: 30 }))).toEqual(["09:00", "09:30"]);
    });

    it("sólo ofrece horarios en los que el servicio termina dentro de la franja", () => {
      expect(startTimes(query({ durationMinutes: 45 }))).toEqual(["09:00", "09:15"]);
      expect(startTimes(query({ durationMinutes: 90 }))).toEqual([]);
    });

    it("cada horario dura lo que dura el servicio", () => {
      const [first] = getAvailableSlots(query({ durationMinutes: 45 }));
      expect(first).toEqual({ start: at("09:00"), end: at("09:45") });
    });

    it("soporta horario cortado sin ofrecer horarios en el medio", () => {
      const input = query({
        workingHours: [hours("09:00", "10:00"), hours("16:00", "17:00")],
        stepMinutes: 30,
      });
      expect(startTimes(input)).toEqual(["09:00", "09:30", "16:00", "16:30"]);
    });

    it("ignora las franjas de otros días de la semana", () => {
      const input = query({ workingHours: [hours("09:00", "10:00", 1)] });
      expect(getAvailableSlots(input)).toEqual([]);
    });

    it("devuelve vacío si el negocio no atiende ese día", () => {
      expect(getAvailableSlots(query({ workingHours: [] }))).toEqual([]);
    });

    it("ordena y no repite horarios aunque las franjas estén desordenadas o solapadas", () => {
      const input = query({
        workingHours: [hours("09:30", "10:30"), hours("09:00", "10:00")],
        stepMinutes: 30,
      });
      expect(startTimes(input)).toEqual(["09:00", "09:30", "10:00"]);
    });

    it("admite una franja que termina a la medianoche", () => {
      const input = query({ workingHours: [hours("23:00", "24:00")] });
      expect(startTimes(input)).toEqual(["23:00", "23:15", "23:30"]);
    });
  });

  describe("intervalos ocupados", () => {
    const input = (busy: AvailabilityInput["busy"]) =>
      query({ workingHours: [hours("09:00", "11:00")], busy });

    it("descarta los horarios que se superponen con un turno existente", () => {
      const busy = [{ start: at("09:30"), end: at("10:00") }];
      expect(startTimes(input(busy))).toEqual(["09:00", "10:00", "10:15", "10:30"]);
    });

    it("permite turnos contiguos (los intervalos son semiabiertos)", () => {
      const busy = [{ start: at("09:30"), end: at("10:00") }];
      const slots = getAvailableSlots(input(busy));
      expect(slots).toContainEqual({ start: at("09:00"), end: at("09:30") });
      expect(slots).toContainEqual({ start: at("10:00"), end: at("10:30") });
    });

    it("descarta horarios que contienen por completo a un intervalo ocupado", () => {
      const busy = [{ start: at("09:40"), end: at("09:50") }];
      expect(startTimes(input(busy))).not.toContain("09:30");
    });

    it("un bloqueo que cubre el día deja la agenda vacía", () => {
      const busy = [{ start: at("00:00"), end: at("23:59") }];
      expect(getAvailableSlots(input(busy))).toEqual([]);
    });
  });

  describe("hora actual", () => {
    it("no ofrece horarios que ya empezaron", () => {
      expect(startTimes(query({ now: at("09:20") }))).toEqual(["09:30"]);
    });

    it("ofrece un horario que empieza exactamente ahora", () => {
      expect(startTimes(query({ now: at("09:15") }))).toEqual(["09:15", "09:30"]);
    });

    it("respeta la anticipación mínima", () => {
      const input = query({
        workingHours: [hours("09:00", "12:00")],
        now: at("09:05"),
        minLeadMinutes: 60,
        stepMinutes: 30,
      });
      expect(startTimes(input)).toEqual(["10:30", "11:00", "11:30"]);
    });
  });

  describe("zonas horarias", () => {
    it("interpreta los horarios en la zona del negocio", () => {
      const [buenosAires] = getAvailableSlots(query());
      const [madrid] = getAvailableSlots(query({ timezone: "Europe/Madrid" }));

      expect(buenosAires.start.toISOString()).toBe("2026-10-20T12:00:00.000Z");
      expect(madrid.start.toISOString()).toBe("2026-10-20T07:00:00.000Z"); // CEST, UTC+2
    });

    it("en el cambio a horario de verano la franja dura una hora menos", () => {
      // Nueva York, 8/3/2026 (domingo): a las 02:00 los relojes pasan a las 03:00.
      const input = query({
        date: "2026-03-08",
        timezone: "America/New_York",
        now: new Date("2026-01-01T00:00:00Z"),
        workingHours: [hours("01:00", "04:00", 0)],
        durationMinutes: 60,
        stepMinutes: 60,
      });
      const starts = getAvailableSlots(input).map(({ start }) => start.toISOString());

      // 01:00 EST y 03:00 EDT: entre 01:00 y 04:00 de reloj hay sólo 2 horas reales.
      expect(starts).toEqual(["2026-03-08T06:00:00.000Z", "2026-03-08T07:00:00.000Z"]);
    });

    it("en el fin del horario de verano la franja dura una hora más", () => {
      // Nueva York, 1/11/2026 (domingo): a las 02:00 los relojes vuelven a la 01:00.
      const input = query({
        date: "2026-11-01",
        timezone: "America/New_York",
        now: new Date("2026-01-01T00:00:00Z"),
        workingHours: [hours("00:00", "03:00", 0)],
        durationMinutes: 60,
        stepMinutes: 60,
      });

      // Entre 00:00 y 03:00 de reloj hay 4 horas reales.
      expect(getAvailableSlots(input)).toHaveLength(4);
    });
  });

  describe("validación", () => {
    it.each(["20-10-2026", "2026-10-2", "mañana", ""])("rechaza el formato %j", (date) => {
      expect(() => getAvailableSlots(query({ date }))).toThrow(RangeError);
    });

    it.each(["2026-02-30", "2026-13-01", "2025-02-29"])("rechaza la fecha inexistente %s", (date) => {
      expect(() => getAvailableSlots(query({ date }))).toThrow(/inexistente/);
    });

    it("acepta el 29 de febrero de un año bisiesto", () => {
      expect(() => getAvailableSlots(query({ date: "2028-02-29" }))).not.toThrow();
    });

    it.each([0, -15, 12.5])("rechaza la duración %d", (durationMinutes) => {
      expect(() => getAvailableSlots(query({ durationMinutes }))).toThrow(RangeError);
    });

    it.each([0, -5])("rechaza el paso %d", (stepMinutes) => {
      expect(() => getAvailableSlots(query({ stepMinutes }))).toThrow(RangeError);
    });
  });
});

describe("weekdayOf", () => {
  it("devuelve el día de la semana con 0 = domingo", () => {
    expect(weekdayOf("2026-10-18")).toBe(0);
    expect(weekdayOf(TUESDAY)).toBe(2);
    expect(weekdayOf("2026-10-24")).toBe(6);
  });
});

describe("dayBounds", () => {
  it("abarca el día completo en la zona del negocio", () => {
    expect(dayBounds(TUESDAY, BA)).toEqual({
      start: new Date("2026-10-20T03:00:00Z"),
      end: new Date("2026-10-21T03:00:00Z"),
    });
  });

  it("un día con cambio de horario dura 23 horas", () => {
    const { start, end } = dayBounds("2026-03-08", "America/New_York");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });
});
