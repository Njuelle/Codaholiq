ALTER TABLE "executions" ADD COLUMN "input_tokens" bigint;--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "output_tokens" bigint;--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "total_cost_micros" bigint;--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "cost_currency" varchar(3) DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "executions" ADD COLUMN "cost_reported_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "executions_created_at_cost_idx" ON "executions" USING btree ("created_at","total_cost_micros");