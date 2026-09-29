CREATE TABLE "moderation_cases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"guild_id" text NOT NULL,
	"case_number" integer NOT NULL,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"target_tag" text NOT NULL,
	"moderator_id" text,
	"moderator_tag" text,
	"reason" text,
	"duration_minutes" integer,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"guild_id" text NOT NULL,
	"ticket_number" integer NOT NULL,
	"thread_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"owner_tag" text,
	"type_id" text,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"claimed_by" text,
	"claimed_by_tag" text,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_cases_guild_case_idx" ON "moderation_cases" USING btree ("guild_id","case_number");--> statement-breakpoint
CREATE INDEX "moderation_cases_guild_created_idx" ON "moderation_cases" USING btree ("guild_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_thread_idx" ON "tickets" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "tickets_guild_status_idx" ON "tickets" USING btree ("guild_id","status");