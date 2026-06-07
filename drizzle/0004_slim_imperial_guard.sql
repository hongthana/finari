CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"alert_preference_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"alert_type" text NOT NULL,
	"channel" text DEFAULT 'in-app' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"email_status" text DEFAULT 'queued' NOT NULL,
	"email_error" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"current_value" double precision,
	"previous_value" double precision,
	"threshold" double precision NOT NULL,
	"condition" text NOT NULL,
	"unit" text NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_alert_preference_id_alert_preferences_id_fk" FOREIGN KEY ("alert_preference_id") REFERENCES "public"."alert_preferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_deliveries_user_created_idx" ON "alert_deliveries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "alert_deliveries_user_read_idx" ON "alert_deliveries" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_deliveries_dedupe_key_idx" ON "alert_deliveries" USING btree ("dedupe_key");