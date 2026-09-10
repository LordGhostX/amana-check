import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDb = globalThis as unknown as {
  __amanaPgClient?: ReturnType<typeof postgres>;
};

export const pgClient =
  globalForDb.__amanaPgClient ??
  postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    prepare: false,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__amanaPgClient = pgClient;
}

export const db = drizzle(pgClient, { schema });

export * as tables from "./schema";
