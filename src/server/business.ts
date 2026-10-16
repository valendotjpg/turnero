import { prisma } from "@/lib/prisma";

/** Datos públicos de un negocio para su página de reservas. */
export async function findPublicBusiness(slug: string) {
  const business = await prisma.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      address: true,
      phone: true,
      services: {
        where: { active: true },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true },
      },
      workingHours: { select: { weekday: true } },
    },
  });
  if (!business) return null;

  const { workingHours, ...rest } = business;
  return { ...rest, openWeekdays: new Set(workingHours.map((w) => w.weekday)) };
}

export type PublicBusiness = NonNullable<Awaited<ReturnType<typeof findPublicBusiness>>>;
