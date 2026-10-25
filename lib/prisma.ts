import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function getPrismaClientConstructor(): any {
  // On Windows, Smart App Control / WDAC blocks query_engine-windows.dll.node and query-engine-windows.exe.
  // We use the WASM-based engine on Windows to prevent `spawn UNKNOWN` crashes.
  // On Linux / Netlify / Vercel, native engines run without WDAC restrictions.
  if (process.platform === "win32") {
    try {
      const { PrismaClient } = require("@prisma/client/wasm");
      return PrismaClient;
    } catch {
      const { PrismaClient } = require("@prisma/client");
      return PrismaClient;
    }
  }
  const { PrismaClient } = require("@prisma/client");
  return PrismaClient;
}

function createPrismaClient(): PrismaClientType {
  const ClientConstructor = getPrismaClientConstructor();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new ClientConstructor();
  }

  try {
    const isServerless = process.env.NODE_ENV === "production" || process.env.NETLIFY === "true";
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // In serverless, keep pool small (2 connections per lambda) to prevent pool exhaustion
      max: isServerless ? 2 : 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      console.warn("[Database Pool Warning]:", (err as Error)?.message || err);
    });

    const adapter = new PrismaPg(pool);
    return new ClientConstructor({ adapter });
  } catch (err) {
    console.error("[Database Client Setup Error]:", err);
    return new ClientConstructor();
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
