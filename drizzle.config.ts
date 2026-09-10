import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env (bun loads .env automatically). Use DATABASE_URL_UNPOOLED for the direct Neon connection when migrating.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
