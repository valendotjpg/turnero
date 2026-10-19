// Contenido de los emails. Cada plantilla devuelve asunto, HTML y texto plano
// (el texto plano lo usan los clientes de correo que no muestran HTML y mejora
// la entregabilidad). Todo dato que escribe un usuario se escapa.

import { formatDateLong, formatPrice, formatTime, localDateOf } from "./dates";

export interface AppointmentEmailData {
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  timezone: string;
  serviceName: string;
  priceCents: number;
  startsAt: Date;
  endsAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  /** Página privada del turno (ver y cancelar). */
  manageUrl: string;
  /** Archivo .ics para agregarlo al calendario. */
  icsUrl: string;
  googleCalendarUrl: string;
  /** Agenda del panel en el día del turno. */
  panelUrl: string;
  /** Página de reservas del negocio. */
  bookingUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const firstName = (name: string) => name.trim().split(/\s+/)[0];

/** "martes, 20 de octubre a las 09:30" */
function when(d: AppointmentEmailData) {
  return `${formatDateLong(localDateOf(d.startsAt, d.timezone))} a las ${formatTime(d.startsAt, d.timezone)}`;
}

type Detail = [label: string, value: string | null | undefined];

interface Layout {
  subject: string;
  /** Texto de vista previa que muestran los clientes de correo. */
  preheader: string;
  heading: string;
  /** Párrafos en texto plano (se escapan). */
  paragraphs: string[];
  details: Detail[];
  actions: { label: string; url: string; primary?: boolean }[];
  footer: string;
}

// Estilos en línea: muchos clientes de correo ignoran <style>.
// Paleta "cuero y cobre" adaptada a fondo claro (muchos clientes de correo
// manejan mal los fondos oscuros). El cobre es más oscuro que el de la web para
// que el texto blanco del botón llegue a 4,9:1.
// Condensada para títulos: Impact viene en casi todos los sistemas; un email no
// puede depender de fuentes web.
const DISPLAY_FONT = "Impact,'Anton','Arial Narrow Bold','Arial Narrow',sans-serif";
const COLORS = { accent: "#b8521a", text: "#1a120c", muted: "#6b5240", border: "#eadfd3", bg: "#f5efe8" };

function render(layout: Layout): RenderedEmail {
  // El asunto lleva datos del cliente: un salto de línea ahí podría colar
  // encabezados en el email. Se aplana a una sola línea.
  const subject = layout.subject.replace(/[\r\n\t]+/g, " ").trim();
  const details = layout.details.filter((d): d is [string, string] => Boolean(d[1]));

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:${COLORS.bg};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(layout.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid ${COLORS.border};border-radius:16px;">
<tr><td style="padding:28px 28px 8px;">
<p style="margin:0 0 10px;font-family:${DISPLAY_FONT};font-size:20px;letter-spacing:.02em;text-transform:uppercase;color:${COLORS.accent};">Turnero</p>
<h1 style="margin:0 0 16px;font-family:${DISPLAY_FONT};font-weight:400;font-size:30px;line-height:1.05;letter-spacing:.02em;text-transform:uppercase;color:${COLORS.accent};">${escapeHtml(layout.heading)}</h1>
${layout.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${escapeHtml(p)}</p>`).join("\n")}
</td></tr>
<tr><td style="padding:8px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;">
${details
  .map(
    ([label, value]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:${COLORS.muted};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(value)}</td></tr>`,
  )
  .join("\n")}
</table>
</td></tr>
<tr><td style="padding:16px 28px 8px;">
${layout.actions
  .map((a) =>
    a.primary
      ? `<a href="${escapeHtml(a.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:10px;background:${COLORS.accent};color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">${escapeHtml(a.label)}</a>`
      : `<a href="${escapeHtml(a.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:10px;border:1px solid ${COLORS.border};color:${COLORS.text};font-weight:600;font-size:14px;text-decoration:none;">${escapeHtml(a.label)}</a>`,
  )
  .join("\n")}
</td></tr>
<tr><td style="padding:16px 28px 28px;border-top:1px solid ${COLORS.border};font-size:12px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(layout.footer)}</td></tr>
</table>
</body>
</html>`;

  const text = [
    layout.heading,
    "",
    ...layout.paragraphs.flatMap((p) => [p, ""]),
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    ...layout.actions.map((a) => `${a.label}: ${a.url}`),
    "",
    "--",
    layout.footer,
  ].join("\n");

  return { subject, html, text };
}

/** Datos del turno, tal como los ve el cliente. */
const customerDetails = (d: AppointmentEmailData): Detail[] => [
  ["Servicio", d.serviceName],
  ["Día", capitalize(formatDateLong(localDateOf(d.startsAt, d.timezone)))],
  ["Horario", `${formatTime(d.startsAt, d.timezone)} a ${formatTime(d.endsAt, d.timezone)}`],
  ["Precio", formatPrice(d.priceCents)],
  ["Dónde", d.businessAddress],
  ["Teléfono", d.businessPhone],
];

/** Datos del turno, tal como los ve el negocio. */
const businessDetails = (d: AppointmentEmailData): Detail[] => [
  ["Cliente", d.customerName],
  ["Email", d.customerEmail],
  ["Teléfono", d.customerPhone],
  ["Servicio", d.serviceName],
  ["Cuándo", capitalize(when(d))],
  ["Nota", d.notes],
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const customerFooter = (d: AppointmentEmailData) =>
  `Recibiste este email porque reservaste un turno en ${d.businessName} a través de Turnero.`;
const businessFooter = "Recibiste este email porque sos parte de este negocio en Turnero.";

export function bookingConfirmation(d: AppointmentEmailData): RenderedEmail {
  return render({
    subject: `Turno confirmado en ${d.businessName}: ${when(d)}`,
    preheader: `${d.serviceName}, ${when(d)}.`,
    heading: `¡Listo, ${firstName(d.customerName)}! Tu turno está confirmado.`,
    paragraphs: [`Te esperamos en ${d.businessName}. Si no podés ir, cancelalo desde el enlace de abajo así el horario le queda a otra persona.`],
    details: customerDetails(d),
    actions: [
      { label: "Ver o cancelar mi turno", url: d.manageUrl, primary: true },
      { label: "Agregar a Google Calendar", url: d.googleCalendarUrl },
      { label: "Descargar para otro calendario (.ics)", url: d.icsUrl },
    ],
    footer: customerFooter(d),
  });
}

export function reminder(d: AppointmentEmailData): RenderedEmail {
  return render({
    subject: `Recordatorio: tu turno en ${d.businessName} es ${when(d)}`,
    preheader: `Mañana: ${d.serviceName} a las ${formatTime(d.startsAt, d.timezone)}.`,
    heading: `${firstName(d.customerName)}, te recordamos tu turno.`,
    paragraphs: ["Si no podés ir, avisá cancelándolo desde el enlace: así el horario le queda a otra persona."],
    details: customerDetails(d),
    actions: [{ label: "Ver o cancelar mi turno", url: d.manageUrl, primary: true }],
    footer: customerFooter(d),
  });
}

export function cancellationConfirmation(d: AppointmentEmailData): RenderedEmail {
  return render({
    subject: `Cancelaste tu turno en ${d.businessName}`,
    preheader: `${d.serviceName}, ${when(d)}: cancelado.`,
    heading: "Tu turno quedó cancelado.",
    paragraphs: [`Le avisamos a ${d.businessName}. Cuando quieras, podés reservar otro horario.`],
    details: customerDetails(d).slice(0, 3),
    actions: [{ label: "Reservar otro turno", url: d.bookingUrl, primary: true }],
    footer: customerFooter(d),
  });
}

export function cancelledByBusiness(d: AppointmentEmailData): RenderedEmail {
  return render({
    subject: `${d.businessName} canceló tu turno`,
    preheader: `${d.serviceName}, ${when(d)}: cancelado por el negocio.`,
    heading: `${firstName(d.customerName)}, tu turno fue cancelado.`,
    paragraphs: [
      `${d.businessName} tuvo que cancelar tu turno. Disculpá las molestias: podés elegir otro horario desde su página de reservas.`,
    ],
    details: customerDetails(d).filter(([label]) => label !== "Precio"),
    actions: [{ label: "Elegir otro horario", url: d.bookingUrl, primary: true }],
    footer: customerFooter(d),
  });
}

export function bookingNotice(d: AppointmentEmailData): RenderedEmail {
  return render({
    subject: `Nuevo turno: ${d.customerName}, ${when(d)}`,
    preheader: `${d.serviceName} reservado online.`,
    heading: "Entró un turno nuevo.",
    paragraphs: [`${d.customerName} reservó online.`],
    details: businessDetails(d),
    actions: [{ label: "Ver la agenda del día", url: d.panelUrl, primary: true }],
    footer: businessFooter,
  });
}

export function cancellationNotice(d: AppointmentEmailData): RenderedEmail {
  return render({
    subject: `Turno cancelado: ${d.customerName}, ${when(d)}`,
    preheader: "El horario quedó libre para otras reservas.",
    heading: "Un cliente canceló su turno.",
    paragraphs: [`${d.customerName} canceló. El horario volvió a quedar disponible para reservas online.`],
    details: businessDetails(d),
    actions: [{ label: "Ver la agenda del día", url: d.panelUrl, primary: true }],
    footer: businessFooter,
  });
}
