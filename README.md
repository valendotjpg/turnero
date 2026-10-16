<h1 align="center">📅 Turnero</h1>

<p align="center">
  <strong>Gestor de turnos para negocios locales: el negocio administra su agenda y sus clientes reservan online, sin llamadas ni mensajes.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/tests-64%20passing-brightgreen?logo=vitest&logoColor=white" alt="64 tests passing">
</p>

> [!NOTE]
> Proyecto en desarrollo. Ver el [plan de etapas](#plan-de-etapas).

---

## El problema

Una barbería, un consultorio o un estudio de uñas suelen manejar los turnos por WhatsApp o en un cuaderno. Cada reserva es un ida y vuelta de mensajes, los horarios libres sólo los conoce quien atiende, y los errores (dos clientes al mismo horario, un turno olvidado) aparecen en el peor momento.

**Turnero** le da al negocio una página pública donde sus clientes ven los horarios realmente disponibles y reservan solos, y un panel para administrar servicios, horarios de atención y la agenda del día.

## Funcionalidades

**Para el cliente** — disponible
- Página de reservas pública por negocio (`/reservar/<negocio>`)
- Elegir servicio, día y horario entre los que están realmente libres
- Enlace privado para ver o cancelar el turno, sin necesidad de crear una cuenta

**Para el negocio** — próximamente
- Panel con login
- Agenda diaria y semanal; marcar turnos como completados o ausentes
- Servicios con duración y precio
- Horarios de atención semanales, incluido horario cortado
- Bloqueos puntuales de agenda (feriados, vacaciones)

## Decisiones de diseño

- **La base de datos impide los turnos superpuestos.** Una restricción `EXCLUDE` de PostgreSQL sobre el rango horario de cada turno activo garantiza que dos reservas simultáneas del mismo horario no puedan pasar ambas, aunque lleguen en el mismo milisegundo. La validación de la aplicación mejora la experiencia; la de la base garantiza la consistencia.
- **Fechas en UTC, horarios en la zona del negocio.** Los turnos se guardan como `timestamptz`; los horarios de atención se expresan en minutos desde la medianoche en la zona horaria del negocio, para que funcionen igual en cualquier fecha.
- **La duración del turno se congela al reservar.** Cada turno guarda su hora de fin, así cambiar la duración de un servicio no altera los turnos ya dados.
- **Precios en centavos** (`Int`) para evitar errores de redondeo.
- **El servidor no confía en el horario que manda el formulario.** Al reservar se vuelve a calcular la disponibilidad y se verifica que el horario elegido esté entre los ofrecidos; si dos personas pasan esa verificación a la vez, la restricción de la base frena a la segunda y la aplicación le muestra "alguien acaba de reservar ese horario". Hay un [test](src/server/booking.int.test.ts) que lanza 8 reservas simultáneas del mismo horario y comprueba que gane sólo una.
- **El enlace del turno es un secreto.** El token tiene 192 bits generados con `crypto.randomBytes` (un `cuid` es predecible y no sirve como secreto), la cancelación es un único `UPDATE` condicionado al estado y la página del turno no se indexa.
- **El progreso de la reserva vive en la URL** (`?servicio=…&fecha=…&hora=…`). Cada paso es un enlace: funciona sin JavaScript, el botón "atrás" deshace el último paso y el enlace se puede compartir. Los parámetros se validan contra los datos reales y uno inválido se ignora.

## Cómo se calculan los horarios libres

El [motor de disponibilidad](src/lib/availability.ts) es lógica pura: recibe los horarios de atención, los intervalos ocupados (turnos activos y bloqueos), la duración del servicio y la hora actual, y devuelve los horarios en los que se puede reservar. Al no tocar la base ni el reloj del sistema, se testea de forma determinística ([tests](src/lib/availability.test.ts)).

```
 Franjas del día        09:00 ─────────── 13:00     16:00 ─────────── 20:00
 Candidatos cada 15'    ▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏               ▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏
 − ya pasados o con menos de 1 h de anticipación
 − los que no terminan dentro de la franja
 − los que se superponen con un turno o un bloqueo
 = horarios ofrecidos
```

Casos contemplados por los tests:

- Horario cortado y franjas desordenadas o solapadas
- Turnos contiguos permitidos: los intervalos son semiabiertos `[inicio, fin)`, igual que en la restricción de la base
- Franjas que terminan a la medianoche
- Cambios de horario de verano: una franja de 01:00 a 04:00 dura 2 horas reales el día que se adelantan los relojes y la de 00:00 a 03:00 dura 4 el día que se atrasan
- Fechas inválidas o inexistentes (`2026-02-30`, `2025-02-29`)

La capa [`src/server/availability.ts`](src/server/availability.ts) busca en la base los datos del día y le delega el cálculo al motor.

## Tests

```bash
npm test                  # unitarios: motor de disponibilidad, fechas y formato
npm run test:integration  # integración contra PostgreSQL real (requiere npm run db:up)
npm run test:all          # ambos
```

Los tests de integración usan una base aparte, `turnero_test`, que se crea sola en el mismo contenedor y recibe las migraciones antes de cada corrida. Cubren la reserva y la cancelación de punta a punta: validación de datos, horarios fuera de la grilla o de la ventana de reserva, superposiciones, reservas simultáneas y la detección del error de la restricción `EXCLUDE`.

## Modelo de datos

```
Business ─┬─< User           administradores del panel
          ├─< Service        nombre, duración, precio
          ├─< WorkingHours   franjas semanales de atención
          ├─< TimeOff        bloqueos puntuales
          └─< Appointment >── Service
```

Ver [`prisma/schema.prisma`](prisma/schema.prisma) y las restricciones adicionales en la [migración inicial](prisma/migrations).

## Cómo correrlo localmente

Requisitos: Node.js 22.12+ y Docker.

```bash
npm install
cp .env.example .env
npm run db:up        # levanta PostgreSQL en Docker (puerto 5433)
npm run db:migrate   # aplica las migraciones
npm run db:seed      # carga un negocio de demostración
npm run dev          # http://localhost:3000
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:integration` / `npm run test:all` | Tests de integración / todos |
| `npm run lint` / `npm run typecheck` | Linter y chequeo de tipos |
| `npm run db:up` | Levanta la base en Docker |
| `npm run db:migrate` | Crea y aplica migraciones |
| `npm run db:seed` | Carga datos de demostración |
| `npm run db:studio` | Explorador visual de la base |

## Plan de etapas

- [x] **Etapa 1 — Base del proyecto:** Next.js + TypeScript, PostgreSQL en Docker, modelo de datos con restricciones de integridad, datos de demostración.
- [x] **Etapa 2 — Motor de disponibilidad:** cálculo de horarios libres a partir de horarios de atención, bloqueos, turnos existentes y zona horaria. Lógica pura con tests unitarios.
- [x] **Etapa 3 — Reserva pública:** flujo de reserva paso a paso, validación con Zod, manejo de conflictos de horario y enlace de cancelación.
- [ ] **Etapa 4 — Panel del negocio:** autenticación, agenda, gestión de servicios, horarios y bloqueos.
- [ ] **Etapa 5 — Notificaciones:** email de confirmación y recordatorio.
- [ ] **Etapa 6 — Publicación:** deploy con demo pública, CI y capturas.

## Limitaciones conocidas

- **Sin límite de reservas por cliente ni protección anti-spam.** Cualquiera puede reservar todos los horarios de un día. Se resolverá con rate limiting y, cuando lleguen los emails, con confirmación por correo.
- **Una página inexistente responde 200 con `noindex`** en vez de 404: la búsqueda ocurre después de empezar a transmitir la página (comportamiento documentado de Next.js al llamar a `notFound()` dentro de `<Suspense>`). A cambio, el armazón de la página se muestra al instante.
- **Las reglas de reserva son fijas** (horarios cada 15 minutos, 1 hora de anticipación, 30 días hacia adelante). Se volverán configurables por negocio desde el panel.

## Licencia

MIT
