ALTER TABLE "checked" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "checked" ALTER COLUMN "updated_at" SET DEFAULT now();