import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestAppointment, createTestBusiness, resetDatabase } from "@/test/fixtures";
import { countAppointmentsByDay, getDayAgenda, updateAppointmentStatus } from "./agenda";
import { getWeeklySchedule, parseDayRanges, saveDaySchedule } from "./schedule";
import { createService, listServices, setServiceActive, updateService } from "./services";
import { createTimeOff, deleteTimeOff, listUpcomingTimeOff } from "./time-off";

const BA = "America/Argentina/Buenos_Aires";
const at = (hhmm: string, date = "2026-10-20") => `${date}T${hhmm}:00.000-03:00`;

// Dos negocios: todo lo que se hace con `mine` no debe poder tocar a `other`.
let mine: Awaited<ReturnType<typeof createTestBusiness>>;
let other: Awaited<ReturnType<typeof createTestBusiness>>;

beforeEach(async () => {
  await resetDatabase();
  mine = await createTestBusiness("mio");
  other = await createTestBusiness("ajeno");
});

afterAll(() => prisma.$disconnect());

describe("servicios", () => {
  const input = { name: "Barba", description: "", durationMinutes: "20", price: "8000.5" };

  it("crea un servicio convirtiendo el precio a centavos", async () => {
    expect(await createService(mine.business.id, input)).toEqual({ ok: true });

    const created = await prisma.service.findFirstOrThrow({ where: { name: "Barba" } });
    expect(created).toMatchObject({
      businessId: mine.business.id,
      durationMinutes: 20,
      priceCents: 800_050,
      description: null,
      active: true,
    });
  });

  it.each([
    [{ name: "B" }, "name", "Ingresá un nombre."],
    [{ durationMinutes: "22" }, "durationMinutes", "La duración debe ser múltiplo de 5 minutos."],
    [{ durationMinutes: "0" }, "durationMinutes", "La duración mínima es de 5 minutos."],
    [{ durationMinutes: "abc" }, "durationMinutes", "Ingresá la duración en minutos."],
    [{ price: "-1" }, "price", "El precio no puede ser negativo."],
  ])("valida %j", async (override, field, message) => {
    const result = await createService(mine.business.id, { ...input, ...override });
    expect(result).toEqual({ ok: false, fieldErrors: { [field]: message } });
  });

  it("edita sólo servicios del propio negocio", async () => {
    const update = { ...input, name: "Corte clásico", description: "Con lavado" };

    expect(await updateService(mine.business.id, mine.service.id, update)).toEqual({ ok: true });
    expect(await updateService(mine.business.id, other.service.id, update)).toMatchObject({ ok: false });
    expect((await prisma.service.findUniqueOrThrow({ where: { id: other.service.id } })).name).toBe("Corte");
  });

  it("pausar un servicio lo saca de la reserva pero conserva sus datos", async () => {
    expect(await setServiceActive(mine.business.id, mine.service.id, false)).toEqual({ ok: true });
    expect(await setServiceActive(mine.business.id, other.service.id, false)).toMatchObject({ ok: false });

    const services = await listServices(mine.business.id);
    expect(services).toHaveLength(1);
    expect(services[0].active).toBe(false);
  });
});

describe("horarios de atención", () => {
  it("reemplaza las franjas de un día y deja los demás intactos", async () => {
    const result = await saveDaySchedule(mine.business.id, 3, [
      { start: "16:00", end: "20:00" },
      { start: "09:00", end: "13:00" },
    ]);
    expect(result).toEqual({ ok: true });

    const week = await getWeeklySchedule(mine.business.id);
    expect(week[2].ranges).toEqual([{ start: "09:00", end: "13:00" }]); // martes, sin cambios
    expect(week[3].ranges).toEqual([
      { start: "09:00", end: "13:00" },
      { start: "16:00", end: "20:00" },
    ]);
  });

  it("una lista vacía deja el día cerrado", async () => {
    await saveDaySchedule(mine.business.id, 2, []);
    expect((await getWeeklySchedule(mine.business.id))[2].ranges).toEqual([]);
    expect((await getWeeklySchedule(other.business.id))[2].ranges).toHaveLength(1);
  });

  it("no modifica nada si las franjas no son válidas", async () => {
    const result = await saveDaySchedule(mine.business.id, 2, [{ start: "13:00", end: "09:00" }]);
    expect(result.ok).toBe(false);
    expect((await getWeeklySchedule(mine.business.id))[2].ranges).toHaveLength(1);
  });

  it.each([
    [[{ start: "9:00", end: "13:00" }], /hora inválida/],
    [[{ start: "10:00", end: "10:00" }], /posterior/],
    [[{ start: "09:00", end: "13:00" }, { start: "12:00", end: "18:00" }], /superponer/],
    [Array(5).fill({ start: "09:00", end: "10:00" }), /hasta 4 franjas/],
  ])("rechaza franjas inválidas %#", (ranges, message) => {
    expect(parseDayRanges(ranges)).toEqual({ error: expect.stringMatching(message) });
  });

  it("interpreta un cierre a las 00:00 como medianoche", () => {
    expect(parseDayRanges([{ start: "20:00", end: "00:00" }])).toEqual({
      ranges: [{ startMinute: 1200, endMinute: 1440 }],
    });
  });

  it("admite franjas contiguas y una que termina a la medianoche", () => {
    expect(
      parseDayRanges([
        { start: "18:00", end: "24:00" },
        { start: "09:00", end: "18:00" },
      ]),
    ).toEqual({
      ranges: [
        { startMinute: 540, endMinute: 1080 },
        { startMinute: 1080, endMinute: 1440 },
      ],
    });
  });
});

describe("bloqueos de agenda", () => {
  const NOW = new Date("2026-10-16T12:00:00Z");

  it("sin horas, bloquea los días completos en la zona del negocio", async () => {
    const result = await createTimeOff(mine.business.id, BA, {
      startDate: "2026-10-20",
      endDate: "2026-10-21",
      reason: "Vacaciones",
    });
    expect(result).toEqual({ ok: true, overlappingAppointments: 0 });

    const [timeOff] = await listUpcomingTimeOff(mine.business.id, NOW);
    expect(timeOff).toMatchObject({
      startsAt: new Date(at("00:00", "2026-10-20")),
      endsAt: new Date(at("00:00", "2026-10-22")),
      reason: "Vacaciones",
    });
  });

  it("con horas, bloquea sólo ese tramo", async () => {
    await createTimeOff(mine.business.id, BA, {
      startDate: "2026-10-20",
      endDate: "2026-10-20",
      startTime: "10:00",
      endTime: "11:30",
    });
    const [timeOff] = await listUpcomingTimeOff(mine.business.id, NOW);
    expect(timeOff).toMatchObject({ startsAt: new Date(at("10:00")), endsAt: new Date(at("11:30")) });
  });

  it("avisa cuántos turnos confirmados quedan dentro del bloqueo", async () => {
    await createTestAppointment(mine.business.id, mine.service.id, at("10:00"), at("10:30"));
    await createTestAppointment(mine.business.id, mine.service.id, at("12:00"), at("12:30"));
    await createTestAppointment(other.business.id, other.service.id, at("10:00"), at("10:30"));

    const result = await createTimeOff(mine.business.id, BA, {
      startDate: "2026-10-20",
      endDate: "2026-10-20",
      startTime: "09:00",
      endTime: "11:00",
    });
    expect(result).toEqual({ ok: true, overlappingAppointments: 1 });
  });

  it("rechaza fechas inválidas o un fin anterior al inicio", async () => {
    const invalid = await createTimeOff(mine.business.id, BA, { startDate: "2026-02-30", endDate: "2026-03-01" });
    expect(invalid).toEqual({ ok: false, fieldErrors: { startDate: "Ingresá una fecha válida." } });

    const reversed = await createTimeOff(mine.business.id, BA, { startDate: "2026-10-21", endDate: "2026-10-20" });
    expect(reversed).toMatchObject({ ok: false, fieldErrors: { endDate: expect.any(String) } });
    expect(await prisma.timeOff.count()).toBe(0);
  });

  it("no lista bloqueos pasados ni ajenos, y sólo borra los propios", async () => {
    await createTimeOff(mine.business.id, BA, { startDate: "2026-10-01", endDate: "2026-10-01" });
    await createTimeOff(other.business.id, BA, { startDate: "2026-10-20", endDate: "2026-10-20" });
    expect(await listUpcomingTimeOff(mine.business.id, NOW)).toEqual([]);

    const othersTimeOff = await prisma.timeOff.findFirstOrThrow({ where: { businessId: other.business.id } });
    expect(await deleteTimeOff(mine.business.id, othersTimeOff.id)).toBe(false);
    expect(await deleteTimeOff(other.business.id, othersTimeOff.id)).toBe(true);
  });
});

describe("agenda", () => {
  it("devuelve los turnos del día en orden, en cualquier estado, sin los de otros días ni negocios", async () => {
    const late = await createTestAppointment(mine.business.id, mine.service.id, at("12:00"), at("12:30"));
    const early = await createTestAppointment(mine.business.id, mine.service.id, at("09:00"), at("09:30"));
    await prisma.appointment.update({ where: { id: early.id }, data: { status: "CANCELLED" } });
    await createTestAppointment(mine.business.id, mine.service.id, at("09:00", "2026-10-21"), at("09:30", "2026-10-21"));
    await createTestAppointment(other.business.id, other.service.id, at("10:00"), at("10:30"));

    const { appointments } = await getDayAgenda(mine.business.id, BA, "2026-10-20");
    expect(appointments.map((a) => [a.id, a.status, a.service.name])).toEqual([
      [early.id, "CANCELLED", "Corte"],
      [late.id, "CONFIRMED", "Corte"],
    ]);
  });

  it("cuenta los turnos no cancelados de cada día en la zona del negocio", async () => {
    // 22:00 del 20 en Buenos Aires ya es 21 en UTC: debe contarse el 20.
    await createTestAppointment(mine.business.id, mine.service.id, at("22:00"), at("22:30"));
    await createTestAppointment(mine.business.id, mine.service.id, at("09:00", "2026-10-21"), at("09:30", "2026-10-21"));
    const cancelled = await createTestAppointment(mine.business.id, mine.service.id, at("10:00", "2026-10-21"), at("10:30", "2026-10-21"));
    await prisma.appointment.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });

    const counts = await countAppointmentsByDay(mine.business.id, BA, ["2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(Object.fromEntries(counts)).toEqual({ "2026-10-20": 1, "2026-10-21": 1, "2026-10-22": 0 });
  });

  describe("cambios de estado", () => {
    const BEFORE = new Date(at("08:00"));
    const AFTER = new Date(at("09:10"));
    let appointmentId: string;

    beforeEach(async () => {
      ({ id: appointmentId } = await createTestAppointment(mine.business.id, mine.service.id, at("09:00"), at("09:30")));
    });

    const status = async () =>
      (await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status;

    it("marca realizado o ausente sólo después de que empezó, y permite deshacerlo", async () => {
      expect((await updateAppointmentStatus(mine.business.id, appointmentId, "COMPLETED", BEFORE)).ok).toBe(false);
      expect(await status()).toBe("CONFIRMED");

      expect(await updateAppointmentStatus(mine.business.id, appointmentId, "COMPLETED", AFTER)).toEqual({ ok: true });
      expect(await updateAppointmentStatus(mine.business.id, appointmentId, "NO_SHOW", AFTER)).toEqual({ ok: true });
      expect(await updateAppointmentStatus(mine.business.id, appointmentId, "CONFIRMED", AFTER)).toEqual({ ok: true });
      expect(await status()).toBe("CONFIRMED");
    });

    it("cancela un turno confirmado y no permite reactivarlo", async () => {
      expect(await updateAppointmentStatus(mine.business.id, appointmentId, "CANCELLED", BEFORE)).toEqual({ ok: true });
      expect(await updateAppointmentStatus(mine.business.id, appointmentId, "CONFIRMED", BEFORE)).toEqual({
        ok: false,
        error: "Ese cambio de estado no está permitido para este turno.",
      });
      expect(await status()).toBe("CANCELLED");
    });

    it("no permite tocar turnos de otro negocio", async () => {
      expect(await updateAppointmentStatus(other.business.id, appointmentId, "CANCELLED", BEFORE)).toEqual({
        ok: false,
        error: "No encontramos ese turno.",
      });
      expect(await status()).toBe("CONFIRMED");
    });
  });
});
