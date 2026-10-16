import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { formatTime, localDateOf, parseTimeOfDay } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/test/fixtures";
import { weekdayOf } from "./availability";
import { resetDemoBusiness } from "./demo-data";

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

// Una semana entera: los turnos de muestra dependen del día en que se generan.
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 18 + i, 15, 0)));

describe("resetDemoBusiness", () => {
  it.each(WEEK.map((d) => [d.toISOString().slice(0, 10), d]))(
    "genera una agenda válida si hoy es %s",
    async (_, now) => {
      const { business, appointments } = await resetDemoBusiness(prisma, now);
      expect(appointments).toBeGreaterThan(20);

      const hours = await prisma.workingHours.findMany({ where: { businessId: business.id } });
      const rows = await prisma.appointment.findMany({ where: { businessId: business.id } });
      const tz = business.timezone;

      for (const a of rows) {
        // Cada turno cae entero dentro de una franja de atención de su día.
        const date = localDateOf(a.startsAt, tz);
        const start = parseTimeOfDay(formatTime(a.startsAt, tz))!;
        const end = parseTimeOfDay(formatTime(a.endsAt, tz))!;
        const fits = hours.some(
          (h) => h.weekday === weekdayOf(date) && h.startMinute <= start && end <= h.endMinute,
        );
        expect(fits, `${date} ${formatTime(a.startsAt, tz)}`).toBe(true);

        // Ningún turno activo cae dentro de un bloqueo de agenda.
        if (a.status !== "CANCELLED") {
          const overlapping = await prisma.timeOff.count({
            where: { businessId: business.id, startsAt: { lt: a.endsAt }, endsAt: { gt: a.startsAt } },
          });
          expect(overlapping, `turno dentro de un bloqueo: ${date}`).toBe(0);
        }

        // Los días pasados quedan resueltos; nada futuro figura como realizado.
        if (a.startsAt > now) expect(["CONFIRMED", "CANCELLED"]).toContain(a.status);
      }
    },
  );

  it("se puede correr de nuevo: reemplaza los datos en vez de duplicarlos", async () => {
    const first = await resetDemoBusiness(prisma, WEEK[0]);
    const second = await resetDemoBusiness(prisma, WEEK[0]);

    expect(await prisma.business.count()).toBe(1);
    expect(await prisma.appointment.count()).toBe(second.appointments);
    expect(second.business.id).not.toBe(first.business.id);
  });
});
