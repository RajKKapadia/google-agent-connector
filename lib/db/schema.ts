import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const planEnum = pgEnum("plan", ["starter", "business", "enterprise"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
  "incomplete",
]);
export const sessionModeEnum = pgEnum("session_mode", ["ai", "human"]);
export const messageDirectionEnum = pgEnum("message_direction", [
  "incoming",
  "outgoing",
]);
export const senderTypeEnum = pgEnum("sender_type", [
  "user",
  "ai",
  "human_agent",
]);

// Subscriptions table — one per Clerk userId
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").unique().notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  plan: planEnum("plan").default("starter"),
  status: subscriptionStatusEnum("status"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Connections table — link a WhatsApp number to a CES agent
export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // WhatsApp / Meta fields
  whatsappAppId: text("whatsapp_app_id").notNull(), // Meta App ID
  whatsappAppSecret: text("whatsapp_app_secret").notNull(), // encrypted Meta App Secret for HMAC
  whatsappPhoneNumberId: text("whatsapp_phone_number_id").notNull(), // Sender ID
  whatsappAccessToken: text("whatsapp_access_token").notNull(), // encrypted
  whatsappVerifyToken: text("whatsapp_verify_token").notNull(), // auto-generated UUID
  // CES / Google fields
  cesAppVersion: text("ces_app_version").notNull(), // full path: projects/P/locations/L/apps/A/versions/V
  cesDeployment: text("ces_deployment"), // full path (optional): projects/.../deployments/D
  googleAccessToken: text("google_access_token").notNull(), // encrypted Google OAuth token
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// End user sessions — one per (connection, waId) pair
export const endUserSessions = pgTable(
  "end_user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    waId: text("wa_id").notNull(), // WhatsApp phone number of end user
    cesSessionId: uuid("ces_session_id").defaultRandom().notNull(), // CES session UUID
    mode: sessionModeEnum("mode").default("ai").notNull(),
    humanModeStartedAt: timestamp("human_mode_started_at"),
    excludeHumanMessagesFromHistory: boolean(
      "exclude_human_messages_from_history"
    )
      .default(false)
      .notNull(),
    pendingCesContext: text("pending_ces_context"),
    lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unique_connection_wa_id").on(t.connectionId, t.waId),
    index("idx_sessions_connection_id").on(t.connectionId),
  ]
);

// Messages table
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => endUserSessions.id, { onDelete: "cascade" }),
    direction: messageDirectionEnum("direction").notNull(),
    senderType: senderTypeEnum("sender_type").notNull(),
    content: text("content").notNull(),
    whatsappMessageId: text("whatsapp_message_id"), // for deduplication
    isHumanAgentMessage: boolean("is_human_agent_message")
      .default(false)
      .notNull(),
    aiHandledAt: timestamp("ai_handled_at"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (t) => [
    index("idx_messages_session_id").on(t.sessionId),
    uniqueIndex("unique_messages_whatsapp_message_id").on(
      t.whatsappMessageId
    ),
    index("idx_messages_timestamp").on(t.timestamp),
  ]
);

// Relations
export const connectionsRelations = relations(connections, ({ many }) => ({
  sessions: many(endUserSessions),
}));

export const endUserSessionsRelations = relations(
  endUserSessions,
  ({ one, many }) => ({
    connection: one(connections, {
      fields: [endUserSessions.connectionId],
      references: [connections.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(endUserSessions, {
    fields: [messages.sessionId],
    references: [endUserSessions.id],
  }),
}));
