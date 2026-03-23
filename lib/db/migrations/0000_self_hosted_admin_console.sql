CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE "channel_type" AS ENUM('whatsapp', 'website');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "message_direction" AS ENUM('incoming', 'outgoing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "sender_type" AS ENUM('user', 'ai', 'human_agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "session_mode" AS ENUM('ai', 'human');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "ces_app_version" text NOT NULL,
  "ces_deployment" text,
  "google_service_account" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid,
  "name" text NOT NULL,
  "type" "channel_type" DEFAULT 'whatsapp' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "whatsapp_app_id" text NOT NULL,
  "whatsapp_app_secret" text NOT NULL,
  "whatsapp_phone_number_id" text NOT NULL,
  "whatsapp_access_token" text NOT NULL,
  "whatsapp_verify_token" text NOT NULL,
  "website_domain" text,
  "widget_key" text,
  "widget_title" text,
  "widget_bubble_color" text,
  "widget_font_family" text,
  "widget_greeting" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "end_user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL,
  "wa_id" text NOT NULL,
  "ces_session_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "mode" "session_mode" DEFAULT 'ai' NOT NULL,
  "human_mode_started_at" timestamp,
  "exclude_human_messages_from_history" boolean DEFAULT false NOT NULL,
  "pending_ces_context" text,
  "last_activity_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "direction" "message_direction" NOT NULL,
  "sender_type" "sender_type" NOT NULL,
  "content" text NOT NULL,
  "whatsapp_message_id" text,
  "is_human_agent_message" boolean DEFAULT false NOT NULL,
  "ai_handled_at" timestamp,
  "timestamp" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "channels"
    ADD CONSTRAINT "channels_agent_id_agents_id_fk"
    FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_sessions"
    ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk"
    FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "end_user_sessions"
    ADD CONSTRAINT "end_user_sessions_channel_id_channels_id_fk"
    FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "messages"
    ADD CONSTRAINT "messages_session_id_end_user_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."end_user_sessions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_admin_sessions_admin_user_id" ON "admin_sessions" USING btree ("admin_user_id");
CREATE INDEX IF NOT EXISTS "idx_channels_agent_id" ON "channels" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_channels_type" ON "channels" USING btree ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_channel_wa_id" ON "end_user_sessions" USING btree ("channel_id", "wa_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_channel_id" ON "end_user_sessions" USING btree ("channel_id");
CREATE INDEX IF NOT EXISTS "idx_messages_session_id" ON "messages" USING btree ("session_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_messages_whatsapp_message_id" ON "messages" USING btree ("whatsapp_message_id");
CREATE INDEX IF NOT EXISTS "idx_messages_timestamp" ON "messages" USING btree ("timestamp");
