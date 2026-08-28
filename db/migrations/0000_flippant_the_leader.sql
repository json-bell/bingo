CREATE TABLE "checked" (
	"cell_id" text PRIMARY KEY NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_slug" text NOT NULL,
	"grid_version" integer NOT NULL,
	"person" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "checked_trip_idx" ON "checked" USING btree ("trip_slug","grid_version");