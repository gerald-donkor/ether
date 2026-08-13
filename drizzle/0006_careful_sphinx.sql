CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_model" text NOT NULL,
	"default_size" text NOT NULL,
	"default_count" integer NOT NULL,
	"default_visibility" "generation_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_default_visibility_binary" CHECK ("user_preferences"."default_visibility" in ('private', 'public')),
	CONSTRAINT "user_preferences_default_count_positive" CHECK ("user_preferences"."default_count" > 0)
);
