import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const checked = pgTable(
  "checked",
  {
    // GridCell.id — a crypto.randomUUID() minted at placement time in
    // data/getGrids.ts's makeGrid(). Stored as text, not uuid: it's an opaque
    // join key that the app never parses, and text keeps it trivially
    // comparable to the string sitting in grids/<slug>/<n>.json.
    cellId: text("cell_id").primaryKey(),
    checked: boolean("checked").notNull().default(false),
    // Server-authoritative. Every successful write sets this to NOW() — see
    // the PATCH contract in docs/backend-architecture.md §4. The client
    // never chooses this value.
    //
    // precision: 3 (milliseconds) is load-bearing, not cosmetic: Postgres's
    // NOW() defaults to microsecond precision, but JS Date/toISOString()
    // only carries milliseconds. A client round-tripping the full-precision
    // value (read it, then send it back as a PATCH's basis) truncates it,
    // so the basis it sends can end up *earlier* than what's actually
    // stored -- failing the optimistic-concurrency guard even on the very
    // first, completely uncontested write. Capping the column at the same
    // precision JS can represent means there's nothing left to truncate.
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),

    // Scoping columns — NOT part of the key, and NOT cell content. Without
    // these, "give me this trip's checked state" has nothing to filter by —
    // see docs/backend-architecture.md §2.
    tripSlug: text("trip_slug").notNull(),
    gridVersion: integer("grid_version").notNull(),
    person: text("person").notNull(),
  },
  (table) => [index("checked_trip_idx").on(table.tripSlug, table.gridVersion)]
);

export type CheckedRow = typeof checked.$inferSelect;
export type NewCheckedRow = typeof checked.$inferInsert;
