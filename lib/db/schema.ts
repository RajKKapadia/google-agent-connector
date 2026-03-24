import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
export const channelTypeEnum = pgEnum("channel_type", ["whatsapp", "website"]);
export const agentPlatformEnum = pgEnum("agent_platform", [
  "ces_agent_studio",
  "conversational_agents",
]);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_admin_sessions_admin_user_id").on(t.adminUserId)]
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  platform: agentPlatformEnum("platform").default("ces_agent_studio").notNull(),
  cesAppVersion: text("ces_app_version"),
  cesDeployment: text("ces_deployment"),
  dialogflowProjectId: text("dialogflow_project_id"),
  dialogflowLocation: text("dialogflow_location"),
  dialogflowAgentId: text("dialogflow_agent_id"),
  dialogflowEnvironmentId: text("dialogflow_environment_id"),
  googleServiceAccount: text("google_service_account").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    type: channelTypeEnum("type").default("whatsapp").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    whatsappAppId: text("whatsapp_app_id").notNull(),
    whatsappAppSecret: text("whatsapp_app_secret").notNull(),
    whatsappPhoneNumberId: text("whatsapp_phone_number_id").notNull(),
    whatsappAccessToken: text("whatsapp_access_token").notNull(),
    whatsappVerifyToken: text("whatsapp_verify_token").notNull(),
    websiteDomain: text("website_domain"),
    widgetKey: text("widget_key"),
    widgetTitle: text("widget_title"),
    widgetBubbleColor: text("widget_bubble_color"),
    widgetFontFamily: text("widget_font_family"),
    widgetGreeting: text("widget_greeting"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_channels_agent_id").on(t.agentId),
    index("idx_channels_type").on(t.type),
  ]
);

export const endUserSessions = pgTable(
  "end_user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    waId: text("wa_id").notNull(),
    cesSessionId: uuid("ces_session_id").defaultRandom().notNull(),
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
    uniqueIndex("unique_channel_wa_id").on(t.channelId, t.waId),
    index("idx_sessions_channel_id").on(t.channelId),
  ]
);

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
    whatsappMessageId: text("whatsapp_message_id"),
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

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [adminSessions.adminUserId],
    references: [adminUsers.id],
  }),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  channels: many(channels),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  agent: one(agents, {
    fields: [channels.agentId],
    references: [agents.id],
  }),
  sessions: many(endUserSessions),
}));

export const endUserSessionsRelations = relations(
  endUserSessions,
  ({ one, many }) => ({
    channel: one(channels, {
      fields: [endUserSessions.channelId],
      references: [channels.id],
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
