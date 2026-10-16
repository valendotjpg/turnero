// Genera las capturas del README recorriendo la app como un usuario: reserva
// un turno, entra al panel y abre el email de confirmación. Sirve también
// como prueba de humo de punta a punta.
//
// Uso (con la app corriendo y los datos de demo recién cargados):
//   npm run db:seed && npm run dev
//   npm run screenshots                      # contra http://localhost:3000
//   BASE_URL=http://localhost:3100 npm run screenshots
//
// Usa el Edge o Chrome instalado (no descarga navegadores).

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const OUT = process.env.SCREENSHOTS_DIR ?? "docs/screenshots";
const DESKTOP = { width: 1280, height: 860 };
const MOBILE = { width: 390, height: 844 };

const browser = await chromium
  .launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" })
  .catch(() => chromium.launch({ channel: "chrome" }));

const newPage = async (viewport, isMobile = false) => {
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: 2,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    colorScheme: "light",
  });
  // Sin barras de scroll ni su espacio reservado: en una captura sólo serían ruido.
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "html{scrollbar-gutter:auto!important}::-webkit-scrollbar{display:none}";
    document.addEventListener("DOMContentLoaded", () => document.head.append(style));
  });
  return context.newPage();
};

const shot = async (page, name, { fullPage = false } = {}) => {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`✓ ${OUT}/${name}.png`);
};

const login = async (page) => {
  await page.goto(`${BASE_URL}/panel/login`);
  await page.getByLabel("Email").fill("duenio@barberia-demo.test");
  await page.getByLabel("Contraseña").fill("turnero-demo");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${BASE_URL}/panel`);
  await page.getByText(/turnos?$|Sin turnos/).first().waitFor();
};

await mkdir(OUT, { recursive: true });

try {
  // 1. Reserva: servicio y día elegidos, con los horarios libres a la vista.
  const booking = await newPage(DESKTOP);
  await booking.goto(`${BASE_URL}/reservar/barberia-demo`);
  await booking.getByRole("link", { name: /Corte de pelo/ }).click();
  await booking.locator("#dia a").nth(3).click(); // el cuarto día con atención
  await booking.locator("#horario a").first().waitFor();
  await booking.evaluate(() => window.scrollTo(0, 0));
  await shot(booking, "01-reserva", { fullPage: true });

  // 2. Confirmación, en celular.
  const mobileBooking = await newPage(MOBILE, true);
  await mobileBooking.goto(booking.url());
  await mobileBooking.locator("#horario a").nth(3).click();
  await mobileBooking.getByLabel("Nombre y apellido").fill("Ana Gómez");
  await mobileBooking.getByLabel("Email").fill("ana@example.com");
  await mobileBooking.getByRole("button", { name: "Confirmar turno" }).click();
  await mobileBooking.waitForURL(/\/turno\//);
  await mobileBooking.getByText(/Tu turno está reservado/).waitFor();
  await shot(mobileBooking, "02-turno-confirmado");

  // 3. Agenda del panel, en escritorio y en celular.
  const panel = await newPage(DESKTOP);
  await login(panel);
  await shot(panel, "03-agenda");

  const mobilePanel = await newPage(MOBILE, true);
  await login(mobilePanel);
  await shot(mobilePanel, "04-agenda-celular");

  // 4. Horarios de atención.
  await panel.goto(`${BASE_URL}/panel/horarios`);
  await panel.getByRole("heading", { name: "Martes" }).waitFor();
  await shot(panel, "05-horarios");

  // 5. El email de confirmación que recibió el cliente.
  await panel.goto(`${BASE_URL}/panel/emails`);
  await panel.getByRole("link", { name: /Confirmación al cliente/ }).first().click();
  await panel.locator("iframe").waitFor();
  await shot(panel, "06-email");
} finally {
  await browser.close();
}
