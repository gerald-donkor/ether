CREATE TYPE "public"."generation_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "visibility" "generation_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
UPDATE "generations" SET "visibility" = 'public' WHERE "is_public" = true;--> statement-breakpoint
DROP INDEX "generations_public_created_at_idx";--> statement-breakpoint
ALTER TABLE "generations" DROP COLUMN "is_public";--> statement-breakpoint
CREATE INDEX "generations_visibility_created_at_idx" ON "generations" USING btree ("visibility","created_at" DESC NULLS LAST);
