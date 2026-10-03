CREATE TABLE "suggestion_votes" (
	"suggestion_id" text NOT NULL,
	"user_id" text NOT NULL,
	"direction" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suggestion_votes_suggestion_id_user_id_pk" PRIMARY KEY("suggestion_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"guild_id" text NOT NULL,
	"number" integer NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"channel_id" text,
	"message_id" text,
	"thread_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "suggestion_votes_suggestion_idx" ON "suggestion_votes" USING btree ("suggestion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suggestions_guild_number_idx" ON "suggestions" USING btree ("guild_id","number");--> statement-breakpoint
CREATE INDEX "suggestions_guild_status_idx" ON "suggestions" USING btree ("guild_id","status","created_at");--> statement-breakpoint
CREATE INDEX "suggestions_guild_message_idx" ON "suggestions" USING btree ("guild_id","message_id");