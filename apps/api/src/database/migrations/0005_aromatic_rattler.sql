ALTER TYPE "public"."execution_status" ADD VALUE 'cost_blocked';--> statement-breakpoint
ALTER TABLE "automations" ADD COLUMN "monthly_cost_limit_micros" bigint;