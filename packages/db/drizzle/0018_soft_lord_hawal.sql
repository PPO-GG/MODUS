CREATE TABLE "starboard_posts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"guild_id" text NOT NULL,
	"board_id" text NOT NULL,
	"source_channel_id" text NOT NULL,
	"source_message_id" text NOT NULL,
	"author_id" text NOT NULL,
	"board_message_id" text,
	"star_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "starboard_posts_guild_board_source_idx" ON "starboard_posts" USING btree ("guild_id","board_id","source_message_id");--> statement-breakpoint
CREATE INDEX "starboard_posts_guild_board_stars_idx" ON "starboard_posts" USING btree ("guild_id","board_id","star_count");--> statement-breakpoint
CREATE INDEX "starboard_posts_guild_source_idx" ON "starboard_posts" USING btree ("guild_id","source_message_id");