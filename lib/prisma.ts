import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new PrismaClient();
  }

  // Use Neon serverless WebSocket adapter only in Edge runtime (where native TCP sockets are not available)
  if (process.env.NEXT_RUNTIME === "edge" && connectionString.includes("neon.tech")) {
    try {
      const pool = new Pool({ connectionString });
      pool.on("error", (err) => {
        console.warn("[Neon Database Pool Notice]:", (err as Error)?.message || err);
      });
      const adapter = new PrismaNeon(pool);
      return new PrismaClient({ adapter });
    } catch (e) {
      console.warn("[Prisma Neon Adapter Fallback]:", e);
      return new PrismaClient();
    }
  }

  // In Node.js (Next.js server & CLI scripts), native Prisma Rust Engine connects via robust TCP (zero WebSocket dropouts)
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
