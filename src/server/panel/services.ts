// Servicios que ofrece el negocio. Todas las funciones reciben el negocio de
// la sesión y filtran por él: un id de otro negocio se comporta como inexistente.

import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fieldErrorsOf, optional, type MutationResult } from "@/lib/validation";

export const serviceInputSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresá un nombre.").max(80, "El nombre es demasiado largo."),
    description: optional(
      z.string().trim().max(300, "La descripción no puede superar los 300 caracteres."),
    ),
    durationMinutes: z.coerce
      .number({ error: "Ingresá la duración en minutos." })
      .int("La duración debe ser un número entero de minutos.")
      .min(5, "La duración mínima es de 5 minutos.")
      .max(480, "La duración máxima es de 8 horas.")
      .refine((n) => n % 5 === 0, "La duración debe ser múltiplo de 5 minutos."),
    price: z.coerce
      .number({ error: "Ingresá el precio." })
      .min(0, "El precio no puede ser negativo.")
      .max(10_000_000, "El precio es demasiado alto."),
  })
  .transform(({ price, ...rest }) => ({ ...rest, priceCents: Math.round(price * 100) }));

export type ServiceField = keyof z.input<typeof serviceInputSchema>;

export function listServices(businessId: string) {
  return prisma.service.findMany({
    where: { businessId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      priceCents: true,
      active: true,
    },
  });
}

export async function createService(
  businessId: string,
  rawInput: unknown,
): Promise<MutationResult<ServiceField>> {
  const parsed = serviceInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  await prisma.service.create({ data: { ...parsed.data, businessId } });
  return { ok: true };
}

export async function updateService(
  businessId: string,
  serviceId: string,
  rawInput: unknown,
): Promise<MutationResult<ServiceField>> {
  const parsed = serviceInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  // Cambiar la duración no afecta a los turnos ya dados: cada uno guarda su fin.
  const { count } = await prisma.service.updateMany({
    where: { id: serviceId, businessId },
    data: { ...parsed.data, description: parsed.data.description ?? null },
  });
  return count === 1 ? { ok: true } : { ok: false, error: "No encontramos ese servicio." };
}

/**
 * Activa o pausa un servicio. Un servicio pausado deja de ofrecerse en la
 * reserva online, pero sus turnos (pasados y futuros) se conservan.
 */
export async function setServiceActive(
  businessId: string,
  serviceId: string,
  active: boolean,
): Promise<MutationResult> {
  const { count } = await prisma.service.updateMany({
    where: { id: serviceId, businessId },
    data: { active },
  });
  return count === 1 ? { ok: true } : { ok: false, error: "No encontramos ese servicio." };
}
