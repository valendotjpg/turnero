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
</p>

> [!NOTE]
> Proyecto en desarrollo. Ver el [plan de etapas](#plan-de-etapas).

---

## El problema

Una barbería, un consultorio o un estudio de uñas suelen manejar los turnos por WhatsApp o en un cuaderno. Cada reserva es un ida y vuelta de mensajes, los horarios libres sólo los conoce quien atiende, y los errores (dos clientes al mismo horario, un turno olvidado) aparecen en el peor momento.

**Turnero** le da al negocio una página pública donde sus clientes ven los horarios realmente disponibles y reservan solos, y un panel para administrar servicios, horarios de atención y la agenda del día.

## Funcionalidades previstas

**Para el cliente**
- Página de reservas pública por negocio (`/reservar/<negocio>`)
- Elegir servicio, día y horario entre los que están realmente libres
- Enlace para cancelar el turno sin necesidad de crear una cuenta

**Para el negocio**
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

Requisitos: Node.js 20+ y Docker.

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
| `npm run lint` / `npm run typecheck` | Linter y chequeo de tipos |
| `npm run db:up` | Levanta la base en Docker |
| `npm run db:migrate` | Crea y aplica migraciones |
| `npm run db:seed` | Carga datos de demostración |
| `npm run db:studio` | Explorador visual de la base |

## Plan de etapas

- [x] **Etapa 1 — Base del proyecto:** Next.js + TypeScript, PostgreSQL en Docker, modelo de datos con restricciones de integridad, datos de demostración.
- [ ] **Etapa 2 — Motor de disponibilidad:** cálculo de horarios libres a partir de horarios de atención, bloqueos, turnos existentes y zona horaria. Lógica pura con tests unitarios.
- [ ] **Etapa 3 — Reserva pública:** flujo de reserva paso a paso, validación con Zod, manejo de conflictos de horario y enlace de cancelación.
- [ ] **Etapa 4 — Panel del negocio:** autenticación, agenda, gestión de servicios, horarios y bloqueos.
- [ ] **Etapa 5 — Notificaciones:** email de confirmación y recordatorio.
- [ ] **Etapa 6 — Publicación:** deploy con demo pública, CI y capturas.

## Licencia

MIT
