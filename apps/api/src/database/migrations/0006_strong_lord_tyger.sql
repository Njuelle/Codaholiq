CREATE TABLE "model_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"repo_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer NOT NULL,
	CONSTRAINT "model_policies_org_repo_provider_model_unique" UNIQUE("org_id","repo_id","provider","model")
);
--> statement-breakpoint
ALTER TABLE "model_policies" ADD CONSTRAINT "model_policies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_policies" ADD CONSTRAINT "model_policies_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_policies" ADD CONSTRAINT "model_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_policies_org_repo_idx" ON "model_policies" USING btree ("org_id","repo_id");