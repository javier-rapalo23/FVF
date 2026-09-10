import { PrismaClient } from "@prisma/client";

// En desarrollo Next.js recarga los módulos en cada cambio; sin este singleton
// se abrirían conexiones nuevas a Postgres en cada recarga.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
