CREATE TABLE "autorole_grants" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "autorole_grants_guild_user_rule_idx" ON "autorole_grants" USING btree ("guild_id","user_id","rule_id");--> statement-breakpoint
CREATE INDEX "autorole_grants_guild_rule_idx" ON "autorole_grants" USING btree ("guild_id","rule_id");