CREATE TABLE "bot_feedback" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"contact_ok" boolean DEFAULT false NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bot_feedback_user_created_idx" ON "bot_feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bot_feedback_status_created_idx" ON "bot_feedback" USING btree ("status","created_at");