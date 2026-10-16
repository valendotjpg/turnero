import { describe, expect, it } from "vitest";
import {
  bookingConfirmation,
  bookingNotice,
  cancellationConfirmation,
  cancellationNotice,
  cancelledByBusiness,
  escapeHtml,
  reminder,
  type AppointmentEmailData,
} from "./email-templates";

const data: AppointmentEmailData = {
  businessName: "Barbería Demo",
  businessAddress: "Av. Siempreviva 742",
  businessPhone: "+54 11 5555-0000",
  timezone: "America/Argentina/Buenos_Aires",
  serviceName: "Corte de pelo",
  priceCents: 1_200_000,
  startsAt: new Date("2026-10-20T13:30:00Z"), // 10:30 en Buenos Aires
  endsAt: new Date("2026-10-20T14:00:00Z"),
  customerName: "Ana Gómez",
  customerEmail: "ana@example.com",
  customerPhone: null,
  notes: null,
  manageUrl: "http://localhost:3000/turno/TOKEN",
  icsUrl: "http://localhost:3000/turno/TOKEN/calendario.ics",
  googleCalendarUrl: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=a&dates=b",
  panelUrl: "http://localhost:3000/panel?fecha=2026-10-20",
  bookingUrl: "http://localhost:3000/reservar/barberia-demo",
};

describe("escapeHtml", () => {
  it("escapa los caracteres especiales de HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("plantillas", () => {
  it("la confirmación incluye fecha y hora en la zona del negocio, y los enlaces", () => {
    const email = bookingConfirmation(data);

    expect(email.subject).toBe("Turno confirmado en Barbería Demo: martes, 20 de octubre a las 10:30");
    expect(email.html).toContain("¡Listo, Ana! Tu turno está confirmado.");
    expect(email.html).toContain("10:30 a 11:00");
    expect(email.html).toContain(`href="${data.manageUrl}"`);
    expect(email.html).toContain(`href="${escapeHtml(data.googleCalendarUrl)}"`);
    expect(email.text).toContain(`Ver o cancelar mi turno: ${data.manageUrl}`);
  });

  it("escapa lo que escribe el cliente para que no pueda inyectar HTML", () => {
    const email = bookingNotice({
      ...data,
      customerName: `<img src=x onerror="alert(1)">`,
      notes: "<script>robar()</script>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;script&gt;robar()&lt;/script&gt;");
  });

  it("aplana el asunto a una sola línea, para que no se puedan inyectar encabezados", () => {
    const email = bookingNotice({ ...data, customerName: "Ana\r\nBcc: todos@example.com" });
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("omite los datos vacíos", () => {
    const email = bookingNotice({ ...data, customerPhone: null, notes: null });
    expect(email.text).not.toContain("Teléfono:");
    expect(email.text).not.toContain("Nota:");

    const withNotes = bookingNotice({ ...data, notes: "Prefiere tijera" });
    expect(withNotes.text).toContain("Nota: Prefiere tijera");
  });

  it.each([
    ["confirmación", bookingConfirmation, "ana"],
    ["recordatorio", reminder, "recordamos"],
    ["cancelación del cliente", cancellationConfirmation, "cancelado"],
    ["cancelación del negocio", cancelledByBusiness, "cancelado"],
    ["aviso de turno nuevo", bookingNotice, "turno nuevo"],
    ["aviso de cancelación", cancellationNotice, "canceló"],
  ])("%s: tiene asunto, HTML y texto plano coherentes", (_, template, keyword) => {
    const email = template(data);
    expect(email.subject.length).toBeGreaterThan(10);
    expect(email.html).toMatch(/^<!doctype html>/);
    expect(email.text.toLowerCase()).toContain(keyword);
    // Todo enlace del HTML también aparece en el texto plano.
    for (const [, href] of email.html.matchAll(/href="([^"]+)"/g)) {
      expect(email.text).toContain(href.replaceAll("&amp;", "&"));
    }
  });

  it("los emails al negocio llevan a la agenda; los del cliente, nunca al panel", () => {
    expect(bookingNotice(data).html).toContain(data.panelUrl);
    for (const template of [bookingConfirmation, reminder, cancellationConfirmation, cancelledByBusiness]) {
      expect(template(data).html).not.toContain("/panel");
    }
  });
});
