import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestAppointment, createTestBusiness, resetDatabase } from "@/test/fixtures";
import { bookAppointment, cancelAppointment } from "../booking";
import { updateAppointmentStatus } from "../panel/agenda";
import type { Mailer, OutgoingEmail } from "./mailer";
import { enqueueReminders, MAX_ATTEMPTS, processOutbox, retryDelayMs } from "./outbox";

const NOW = new Date("2026-10-15T12:00:00Z");
const at = (hhmm: string, date = "2026-10-20") => `${date}T${hhmm}:00.000-03:00`;

/** Mailer falso: guarda lo que "envía" y puede fallar a pedido. */
function fakeMailer({ failWith }: { failWith?: string } = {}) {
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = {
    async send(email) {
      if (failWith) throw new Error(failWith);
      sent.push(email);
    },
  };
  return { mailer, sent };
}

let test: Awaited<ReturnType<typeof createTestBusiness>>;

beforeEach(async () => {
  await resetDatabase();
  test = await createTestBusiness();
});

afterAll(() => prisma.$disconnect());

const book = (startsAt = at("09:00")) =>
  bookAppointment(
    test.business.slug,
    { serviceId: test.service.id, startsAt, customerName: "Ana Gómez", customerEmail: "ana@example.com" },
    NOW,
  );

const queued = () =>
  prisma.emailMessage.findMany({ orderBy: { kind: "asc" }, select: { kind: true, to: true, status: true } });

describe("qué se encola", () => {
  it("al reservar: confirmación al cliente y aviso al negocio", async () => {
    const result = await book();
    expect(result.ok).toBe(true);

    expect(await queued()).toEqual([
      { kind: "BOOKING_CONFIRMATION", to: "ana@example.com", status: "PENDING" },
      { kind: "BOOKING_NOTICE", to: test.user.email, status: "PENDING" },
    ]);
  });

  it("el email lleva el enlace privado del turno", async () => {
    const result = await book();
    if (!result.ok) throw new Error("No se pudo reservar");

    const confirmation = await prisma.emailMessage.findFirstOrThrow({ where: { kind: "BOOKING_CONFIRMATION" } });
    expect(confirmation.html).toContain(`/turno/${result.cancelToken}`);
    expect(confirmation.subject).toContain("martes, 20 de octubre a las 09:00");
  });

  it("una reserva rechazada no encola nada", async () => {
    await book();
    const before = await prisma.emailMessage.count();

    const second = await book(); // mismo horario
    expect(second).toMatchObject({ ok: false, reason: "SLOT_UNAVAILABLE" });
    expect(await prisma.emailMessage.count()).toBe(before);
  });

  it("si el cliente cancela: confirmación al cliente y aviso al negocio", async () => {
    const result = await book();
    if (!result.ok) throw new Error("No se pudo reservar");
    await prisma.emailMessage.deleteMany();

    expect(await cancelAppointment(result.cancelToken, NOW)).toEqual({ ok: true });
    expect((await queued()).map((e) => [e.kind, e.to])).toEqual([
      ["CANCELLATION_CONFIRMATION", "ana@example.com"],
      ["CANCELLATION_NOTICE", test.user.email],
    ]);

    // Una segunda cancelación falla y no encola nada más.
    await cancelAppointment(result.cancelToken, NOW);
    expect(await prisma.emailMessage.count()).toBe(2);
  });

  it("si el negocio cancela, se le avisa al cliente; marcar realizado no manda nada", async () => {
    const a = await createTestAppointment(test.business.id, test.service.id, at("09:00"), at("09:30"));
    const b = await createTestAppointment(test.business.id, test.service.id, at("10:00"), at("10:30"));

    await updateAppointmentStatus(test.business.id, a.id, "CANCELLED", NOW);
    await updateAppointmentStatus(test.business.id, b.id, "COMPLETED", new Date(at("10:05")));

    expect((await queued()).map((e) => [e.kind, e.to])).toEqual([["CANCELLED_BY_BUSINESS", "cliente@example.com"]]);
  });
});

describe("processOutbox", () => {
  // Los emails se encolan con nextAttemptAt = hora real de la base; el worker
  // se corre con la hora real (más un margen) para que ya estén listos.
  const sendNow = () => new Date(Date.now() + 1000);
  it("envía los pendientes y los marca como enviados", async () => {
    await book();
    const { mailer, sent } = fakeMailer();

    const now = sendNow();
    expect(await processOutbox({ mailer, now })).toEqual({ sent: 2, failed: 0, retrying: 0 });
    expect(sent.map((e) => e.to).sort()).toEqual(["ana@example.com", test.user.email].sort());
    expect((await queued()).every((e) => e.status === "SENT")).toBe(true);

    // Una segunda corrida no reenvía nada.
    expect(await processOutbox({ mailer, now })).toEqual({ sent: 0, failed: 0, retrying: 0 });
    expect(sent).toHaveLength(2);
  });

  it("si el envío falla, reintenta con espera exponencial y al final se rinde", async () => {
    await book();
    await prisma.emailMessage.deleteMany({ where: { kind: "BOOKING_NOTICE" } });
    const { mailer } = fakeMailer({ failWith: "SMTP caído" });
    const email = () => prisma.emailMessage.findFirstOrThrow();

    let now = sendNow();
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      expect(await processOutbox({ mailer, now })).toEqual({ sent: 0, failed: 0, retrying: 1 });
      const current = await email();
      expect(current).toMatchObject({ status: "PENDING", attempts: attempt, lastError: "SMTP caído" });
      expect(current.nextAttemptAt).toEqual(new Date(now.getTime() + retryDelayMs(attempt)));

      // Antes de que se cumpla la espera, no se reintenta.
      expect(await processOutbox({ mailer, now: new Date(current.nextAttemptAt.getTime() - 1) })).toEqual({
        sent: 0,
        failed: 0,
        retrying: 0,
      });
      now = current.nextAttemptAt;
    }

    expect(await processOutbox({ mailer, now })).toEqual({ sent: 0, failed: 1, retrying: 0 });
    expect(await email()).toMatchObject({ status: "FAILED", attempts: MAX_ATTEMPTS });
  });

  it("un email que falló una vez sale en el reintento", async () => {
    await book();
    const now = sendNow();
    await processOutbox({ mailer: fakeMailer({ failWith: "timeout" }).mailer, now });

    const { mailer, sent } = fakeMailer();
    const later = new Date(now.getTime() + retryDelayMs(1));
    expect(await processOutbox({ mailer, now: later })).toEqual({ sent: 2, failed: 0, retrying: 0 });
    expect(sent).toHaveLength(2);
  });

  it("con varios workers a la vez, cada email se envía una sola vez", async () => {
    for (const hhmm of ["09:00", "09:30", "10:00", "10:30", "11:00"]) await book(at(hhmm));
    const { mailer, sent } = fakeMailer();

    const now = sendNow();
    const reports = await Promise.all(Array.from({ length: 4 }, () => processOutbox({ mailer, now })));

    expect(reports.reduce((total, r) => total + r.sent, 0)).toBe(10);
    expect(sent).toHaveLength(10);
    expect(new Set(sent.map((e) => e.subject + e.to)).size).toBe(10);
  });

  it("recupera un email que quedó tomado por un worker que se cayó", async () => {
    await book();
    const lockedAt = sendNow();
    await prisma.emailMessage.updateMany({ data: { status: "SENDING", lockedAt } });
    const { mailer, sent } = fakeMailer();

    // Recién tomado: se respeta el lock.
    await processOutbox({ mailer, now: new Date(lockedAt.getTime() + 60_000) });
    expect(sent).toHaveLength(0);

    // Pasados 10 minutos, se considera abandonado y se envía.
    await processOutbox({ mailer, now: new Date(lockedAt.getTime() + 11 * 60_000) });
    expect(sent).toHaveLength(2);
  });
});

describe("enqueueReminders", () => {
  const HOUR = 3_600_000;
  const reminders = () => prisma.emailMessage.count({ where: { kind: "REMINDER" } });

  async function appointmentStartingIn(hours: number, { bookedHoursBefore }: { bookedHoursBefore: number }) {
    const startsAt = new Date(NOW.getTime() + hours * HOUR);
    const a = await createTestAppointment(
      test.business.id,
      test.service.id,
      startsAt.toISOString(),
      new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
    );
    return prisma.appointment.update({
      where: { id: a.id },
      data: { createdAt: new Date(startsAt.getTime() - bookedHoursBefore * HOUR) },
    });
  }

  it("encola el recordatorio de un turno que empieza dentro de 24 horas, una sola vez", async () => {
    await appointmentStartingIn(20, { bookedHoursBefore: 72 });

    expect(await enqueueReminders(NOW)).toBe(1);
    expect(await enqueueReminders(NOW)).toBe(0);
    expect(await reminders()).toBe(1);
  });

  it("un recordatorio encolado sale en la misma corrida del cron", async () => {
    await appointmentStartingIn(20, { bookedHoursBefore: 72 });
    const { mailer, sent } = fakeMailer();

    // Lo mismo que hace /api/cron: encolar y enviar con el mismo "ahora".
    await enqueueReminders(NOW);
    expect(await processOutbox({ mailer, now: NOW })).toEqual({ sent: 1, failed: 0, retrying: 0 });
    expect(sent[0].subject).toMatch(/^Recordatorio:/);
  });

  it("no recuerda turnos que faltan más de 24 horas, ni pasados, ni cancelados", async () => {
    await appointmentStartingIn(30, { bookedHoursBefore: 72 });
    await appointmentStartingIn(-1, { bookedHoursBefore: 72 });
    const cancelled = await appointmentStartingIn(5, { bookedHoursBefore: 72 });
    await prisma.appointment.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });

    expect(await enqueueReminders(NOW)).toBe(0);
  });

  it("no recuerda turnos reservados con menos de 24 horas de anticipación", async () => {
    const recent = await appointmentStartingIn(10, { bookedHoursBefore: 3 });

    expect(await enqueueReminders(NOW)).toBe(0);
    // Igual queda marcado, para no volver a evaluarlo en cada corrida.
    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: recent.id } });
    expect(after.reminderQueuedAt).toEqual(NOW);
  });

  it("con dos procesos a la vez, el recordatorio se encola una sola vez", async () => {
    await appointmentStartingIn(20, { bookedHoursBefore: 72 });
    const results = await Promise.all([enqueueReminders(NOW), enqueueReminders(NOW), enqueueReminders(NOW)]);
    expect(results.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await reminders()).toBe(1);
  });
});
