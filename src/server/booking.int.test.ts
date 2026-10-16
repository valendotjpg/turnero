import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeSlots, findSlotContext } from "./availability";
import {
  bookAppointment,
  cancelAppointment,
  findAppointmentByToken,
  isExclusionViolation,
  type BookingResult,
} from "./booking";

const SLUG = "negocio-test";
// Jueves 15/10/2026, 09:00 en Buenos Aires. El martes siguiente es el 20.
const NOW = new Date("2026-10-15T12:00:00Z");
const at = (hhmm: string, date = "2026-10-20") => `${date}T${hhmm}:00.000-03:00`;

let serviceId: string;

beforeEach(async () => {
  await prisma.business.deleteMany();
  const business = await prisma.business.create({
    data: {
      name: "Negocio de prueba",
      slug: SLUG,
      timezone: "America/Argentina/Buenos_Aires",
      // Martes de 09:00 a 13:00.
      workingHours: { create: { weekday: 2, startMinute: 540, endMinute: 780 } },
      services: { create: { name: "Corte", durationMinutes: 30, priceCents: 1_000_000 } },
    },
    include: { services: true },
  });
  serviceId = business.services[0].id;
});

afterAll(() => prisma.$disconnect());

const validInput = (overrides: Record<string, unknown> = {}) => ({
  serviceId,
  startsAt: at("09:00"),
  customerName: "Ana Gómez",
  customerEmail: "Ana@Example.com ",
  customerPhone: "",
  notes: "",
  ...overrides,
});

const book = (overrides?: Record<string, unknown>) =>
  bookAppointment(SLUG, validInput(overrides), NOW);

function expectFailure(result: BookingResult, reason: string) {
  expect(result).toMatchObject({ ok: false, reason });
}

describe("bookAppointment", () => {
  it("reserva un horario libre y guarda el turno normalizado", async () => {
    const result = await book();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cancelToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { cancelToken: result.cancelToken },
    });
    expect(appointment).toMatchObject({
      startsAt: new Date(at("09:00")),
      endsAt: new Date(at("09:30")),
      status: "CONFIRMED",
      customerName: "Ana Gómez",
      customerEmail: "ana@example.com",
      customerPhone: null,
      notes: null,
    });
  });

  it("genera un token distinto para cada turno", async () => {
    const a = await book({ startsAt: at("09:00") });
    const b = await book({ startsAt: at("10:00") });
    expect(a.ok && b.ok && a.cancelToken !== b.cancelToken).toBe(true);
  });

  it("devuelve un error por campo si los datos no son válidos", async () => {
    const result = await book({ customerName: " ", customerEmail: "no-es-un-email" });

    expect(result).toEqual({
      ok: false,
      reason: "INVALID_INPUT",
      fieldErrors: { customerName: "Ingresá tu nombre.", customerEmail: "Ingresá un email válido." },
    });
    expect(await prisma.appointment.count()).toBe(0);
  });

  it("rechaza servicios inexistentes, inactivos o de otro negocio", async () => {
    expectFailure(await book({ serviceId: "no-existe" }), "NOT_FOUND");

    await prisma.service.update({ where: { id: serviceId }, data: { active: false } });
    expectFailure(await book(), "NOT_FOUND");

    expectFailure(await bookAppointment("otro-negocio", validInput(), NOW), "NOT_FOUND");
  });

  it.each([
    ["fuera de la grilla de horarios", at("09:07")],
    ["fuera del horario de atención", at("14:00")],
    ["en un día sin atención", at("09:00", "2026-10-19")],
    ["más allá de la ventana de reserva", at("09:00", "2026-12-01")],
    ["en el pasado", at("09:00", "2026-10-13")],
  ])("rechaza un horario %s", async (_, startsAt) => {
    expectFailure(await book({ startsAt }), "SLOT_UNAVAILABLE");
  });

  it("rechaza un horario ocupado o que se superpone con otro turno", async () => {
    expect((await book({ startsAt: at("09:00") })).ok).toBe(true);

    expectFailure(await book({ startsAt: at("09:00") }), "SLOT_UNAVAILABLE");
    expectFailure(await book({ startsAt: at("09:15") }), "SLOT_UNAVAILABLE");
    expect((await book({ startsAt: at("09:30") })).ok).toBe(true);
  });

  it("de muchas reservas simultáneas del mismo horario, sólo una gana", async () => {
    const attempts = Array.from({ length: 8 }, (_, i) =>
      book({ customerEmail: `cliente${i}@example.com` }),
    );
    const results = await Promise.all(attempts);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "SLOT_UNAVAILABLE")).toHaveLength(7);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it("detecta la violación de la restricción EXCLUDE que lanza la base", async () => {
    await book({ startsAt: at("09:00") });
    const business = await prisma.business.findUniqueOrThrow({ where: { slug: SLUG } });

    // Inserción directa, salteando la verificación de disponibilidad.
    const error = await prisma.appointment
      .create({
        data: {
          businessId: business.id,
          serviceId,
          startsAt: new Date(at("09:15")),
          endsAt: new Date(at("09:45")),
          customerName: "Intruso",
          customerEmail: "x@example.com",
          cancelToken: "x".repeat(32),
        },
      })
      .catch((e: unknown) => e);

    expect(isExclusionViolation(error)).toBe(true);
    expect(isExclusionViolation(new Error("otro error"))).toBe(false);
  });
});

describe("cancelAppointment", () => {
  async function bookedToken() {
    const result = await book();
    if (!result.ok) throw new Error("No se pudo reservar el turno de prueba");
    return result.cancelToken;
  }

  it("cancela el turno y libera el horario", async () => {
    const token = await bookedToken();
    const context = (await findSlotContext(SLUG, serviceId))!;
    const isOffered = async () =>
      (await computeSlots(context, "2026-10-20", NOW)).some(
        (s) => s.start.getTime() === new Date(at("09:00")).getTime(),
      );

    expect(await isOffered()).toBe(false);
    expect(await cancelAppointment(token, NOW)).toEqual({ ok: true });
    expect(await isOffered()).toBe(true);

    const appointment = await findAppointmentByToken(token);
    expect(appointment?.status).toBe("CANCELLED");
  });

  it("no cancela dos veces el mismo turno", async () => {
    const token = await bookedToken();
    await cancelAppointment(token, NOW);
    expect(await cancelAppointment(token, NOW)).toEqual({ ok: false, reason: "NOT_CANCELLABLE" });
  });

  it("no cancela un turno que ya empezó", async () => {
    const token = await bookedToken();
    const later = new Date(at("09:05"));
    expect(await cancelAppointment(token, later)).toEqual({ ok: false, reason: "NOT_CANCELLABLE" });
  });

  it("no encuentra tokens inexistentes o mal formados", async () => {
    await bookedToken();
    expect(await cancelAppointment("A".repeat(32), NOW)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await cancelAppointment("'; DROP TABLE--", NOW)).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });
});

describe("findAppointmentByToken", () => {
  it("devuelve el turno con su servicio y negocio", async () => {
    const result = await book();
    if (!result.ok) throw new Error("No se pudo reservar el turno de prueba");

    expect(await findAppointmentByToken(result.cancelToken)).toMatchObject({
      status: "CONFIRMED",
      customerName: "Ana Gómez",
      service: { name: "Corte", durationMinutes: 30 },
      business: { slug: SLUG },
    });
  });

  it("devuelve null para un token mal formado sin consultar la base", async () => {
    expect(await findAppointmentByToken("corto")).toBeNull();
  });
});
