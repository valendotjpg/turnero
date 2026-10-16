// Horarios de atención semanales.

import "server-only";
import { formatTimeOfDay, parseTimeOfDay } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { MutationResult } from "@/lib/validation";

export interface TimeRange {
  /** "HH:MM" */
  start: string;
  end: string;
}

/** Las 7 jornadas (0 = domingo … 6 = sábado), cada una con sus franjas ordenadas. */
export async function getWeeklySchedule(businessId: string) {
  const rows = await prisma.workingHours.findMany({
    where: { businessId },
    orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    select: { weekday: true, startMinute: true, endMinute: true },
  });

  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    ranges: rows
      .filter((r) => r.weekday === weekday)
      .map((r): TimeRange => ({ start: formatTimeOfDay(r.startMinute), end: formatTimeOfDay(r.endMinute) })),
  }));
}

export const MAX_RANGES_PER_DAY = 4;

/** Valida y normaliza las franjas de un día. Exportada para testearla sola. */
export function parseDayRanges(ranges: TimeRange[]) {
  if (ranges.length > MAX_RANGES_PER_DAY) {
    return { error: `Se admiten hasta ${MAX_RANGES_PER_DAY} franjas por día.` } as const;
  }

  const parsed = [];
  for (const [i, range] of ranges.entries()) {
    const startMinute = parseTimeOfDay(range.start);
    // Los <input type="time"> no admiten "24:00": un cierre a las 00:00 es medianoche.
    const endMinute = range.end === "00:00" ? 24 * 60 : parseTimeOfDay(range.end);
    if (startMinute === null || endMinute === null) {
      return { error: `La franja ${i + 1} tiene una hora inválida.` } as const;
    }
    if (startMinute >= endMinute) {
      return { error: `En la franja ${i + 1}, la hora de cierre debe ser posterior a la de apertura.` } as const;
    }
    parsed.push({ startMinute, endMinute });
  }

  parsed.sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].startMinute < parsed[i - 1].endMinute) {
      return { error: "Las franjas no se pueden superponer." } as const;
    }
  }
  return { ranges: parsed } as const;
}

/**
 * Reemplaza las franjas de un día de la semana. Una lista vacía deja el día
 * cerrado. Los turnos ya dados no se tocan aunque queden fuera del horario.
 */
export async function saveDaySchedule(
  businessId: string,
  weekday: number,
  ranges: TimeRange[],
): Promise<MutationResult> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { ok: false, error: "Día de la semana inválido." };
  }
  const result = parseDayRanges(ranges);
  if ("error" in result) return { ok: false, error: result.error };

  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { businessId, weekday } }),
    prisma.workingHours.createMany({
      data: result.ranges.map((r) => ({ ...r, businessId, weekday })),
    }),
  ]);
  return { ok: true };
}
