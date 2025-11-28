-- statsus column for marking events that are not approved yet by the admins
ALTER TABLE "public"."events" ADD COLUMN "status" text NOT NULL DEFAULT 'pending';