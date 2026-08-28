import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { beforeAll, beforeEach } from "vitest";
import type * as schema from "../../db/schema";

// Must happen before db/client.ts's module body runs (it reads
// process.env.DATABASE_URL at import time) -- a static `import { db }`
// at the top of this file would be hoisted and evaluated before these
// lines, so the db/client import below is deliberately dynamic.
config({ path: ".env.test" });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DB_DRIVER = "pg";

const { db } = await import("../../db/client");

// Once per run: apply the committed migrations to bingo_test. This
// exercises the actual migration files, so a migration that doesn't
// apply cleanly fails the suite -- the closest this project gets to
// what CI would have given us. See docs/backend-architecture.md §7.
beforeAll(async () => {
  // db/client.ts's exported type is a pg | neon union (the driver is picked
  // at runtime by DB_DRIVER), but migrate() needs the pg-specific type.
  // Safe here: DB_DRIVER is hardcoded to "pg" a few lines up, in this file.
  await migrate(db as NodePgDatabase<typeof schema>, { migrationsFolder: "db/migrations" });
});

// Per test: fast, and leaves every test starting from a known-empty
// table. Not drop/recreate -- truncate is milliseconds.
beforeEach(async () => {
  await db.execute(sql`TRUNCATE checked`);
});
