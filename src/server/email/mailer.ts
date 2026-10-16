// Transporte de correo. Con SMTP_URL usa ese servidor (Mailpit en desarrollo;
// en producción, cualquier proveedor SMTP como Resend o SES). Sin SMTP_URL,
// sólo registra los emails en la consola: la app funciona sin configurar nada.

import "server-only";
import nodemailer from "nodemailer";
import { isDemoMode } from "@/lib/demo";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Algo capaz de enviar un email. Los tests usan uno falso. */
export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

let defaultMailer: Mailer | undefined;

export function getMailer(): Mailer {
  if (defaultMailer) return defaultMailer;

  // En la demo pública cualquiera puede escribir cualquier email: mandarlos
  // de verdad la convertiría en un relay de spam. Se "envían" sin salir de la
  // app y se pueden ver desde el panel y desde la página del turno.
  if (isDemoMode()) {
    defaultMailer = { async send() {} };
    return defaultMailer;
  }

  const from = process.env.EMAIL_FROM ?? "Turnero <turnos@turnero.test>";
  const smtpUrl = process.env.SMTP_URL;

  if (!smtpUrl) {
    defaultMailer = {
      async send(email) {
        console.info(`[email] (sin SMTP_URL, no se envía) Para: ${email.to} · ${email.subject}`);
      },
    };
    return defaultMailer;
  }

  const transport = nodemailer.createTransport(smtpUrl);
  defaultMailer = {
    async send(email) {
      await transport.sendMail({ from, ...email });
    },
  };
  return defaultMailer;
}

/** URL pública de la app, para los enlaces de los emails. */
export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}
