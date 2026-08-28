import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

// Explicit, not inferred from the hostname: "does this URL look like Neon?" is
// a guess that breaks the day a connection string format changes. DB_DRIVER
// is set once (in .env.local, .env.test, or the Vercel dashboard) and never
// touched again. Neon's HTTP driver cannot talk to a plain Postgres server at
// all, and a pg Pool in a Vercel function leaks connections across cold
// starts — see docs/backend-architecture.md §1.
export const db =
  process.env.DB_DRIVER === "neon"
    ? drizzleNeon(neon(connectionString), { schema })
    : drizzlePg(new Pool({ connectionString }), { schema });
