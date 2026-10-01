CREATE TABLE "guild_entitlements" (
	"id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"sku_id" text NOT NULL,
	"type" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guild_entitlements_guild_id_idx" ON "guild_entitlements" USING btree ("guild_id");