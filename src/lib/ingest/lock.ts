import postgres from "postgres";
import { optionalEnv } from "@/lib/env";

const LOCK_NAME = "amana-check:ingest";
const globalForLock = globalThis as unknown as {
  __amanaIngestLockClient?: ReturnType<typeof postgres>;
};

let lockClient: ReturnType<typeof postgres> | undefined;

function getLockClient(): ReturnType<typeof postgres> {
  if (lockClient) return lockClient;

  const connectionString = optionalEnv("DATABASE_URL_UNPOOLED")?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_UNPOOLED is required for ingestion locking; set the direct Postgres connection string.",
    );
  }

  lockClient =
    globalForLock.__amanaIngestLockClient ??
    postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      prepare: false,
      onnotice: () => {},
    });

  if (process.env.NODE_ENV !== "production") {
    globalForLock.__amanaIngestLockClient = lockClient;
  }
  return lockClient;
}

export async function closeIngestLockClient(): Promise<void> {
  if (!lockClient) return;
  const client = lockClient;
  lockClient = undefined;
  if (globalForLock.__amanaIngestLockClient === client) {
    delete globalForLock.__amanaIngestLockClient;
  }
  await client.end({ timeout: 5 });
}

export type IngestLockResult<T> =
  { acquired: true; value: T } | { acquired: false };

/**
 * Hold a session-level advisory lock for the duration of one ingest run.
 * A reserved connection keeps the lock independent from Drizzle's pool,
 * while its direct URL avoids transaction-pooler session changes and leaves
 * the four pooled connections available for source work.
 */
export async function withIngestLock<T>(
  work: () => Promise<T>,
): Promise<IngestLockResult<T>> {
  const connection = await getLockClient().reserve();

  try {
    const rows = await connection<{ locked: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${LOCK_NAME})) as locked
    `;
    if (rows[0]?.locked !== true) return { acquired: false };

    try {
      return { acquired: true, value: await work() };
    } finally {
      await connection`
        select pg_advisory_unlock(hashtext(${LOCK_NAME}))
      `;
    }
  } finally {
    connection.release();
  }
}
