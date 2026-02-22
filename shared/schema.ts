import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

export * from "./models/auth";
import { users } from "./models/auth";

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: varchar("plan").notNull().default("trial"),
  status: varchar("status").notNull().default("inactive"),
  amount: integer("amount").notNull().default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  trialStartedAt: timestamp("trial_started_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));

export const algoLogs = pgTable("algo_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  runId: varchar("run_id"),
  level: varchar("level").notNull(),
  message: text("message").notNull(),
  loggedAt: timestamp("logged_at").notNull().defaultNow(),
});

export const algoLogsRelations = relations(algoLogs, ({ one }) => ({
  user: one(users, { fields: [algoLogs.userId], references: [users.id] }),
}));

export const devices = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceFingerprint: text("device_fingerprint").notNull(),
  browserName: text("browser_name"),
  browserVersion: text("browser_version"),
  osName: text("os_name"),
  osVersion: text("os_version"),
  ipAddress: text("ip_address"),
  country: text("country"),
  city: text("city"),
  isTrusted: boolean("is_trusted").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, { fields: [devices.userId], references: [users.id] }),
}));

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  category: text("category").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  severity: text("severity").notNull().default("info"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const encryptedCredentials = pgTable("encrypted_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialType: text("credential_type").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const encryptedCredentialsRelations = relations(encryptedCredentials, ({ one }) => ({
  user: one(users, { fields: [encryptedCredentials.userId], references: [users.id] }),
}));

export const csvConfigs = pgTable("csv_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const csvConfigsRelations = relations(csvConfigs, ({ one }) => ({
  user: one(users, { fields: [csvConfigs.userId], references: [users.id] }),
}));

export type Device = typeof devices.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type EncryptedCredential = typeof encryptedCredentials.$inferSelect;
export type CsvConfig = typeof csvConfigs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type AlgoLog = typeof algoLogs.$inferSelect;

export const insertSubscriptionSchema = z.object({
  userId: z.string(),
  plan: z.enum(["trial", "monthly", "quarterly", "yearly"]),
  status: z.enum(["active", "inactive", "expired", "cancelled"]).default("inactive"),
  amount: z.number().default(0),
});

export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email().optional().or(z.literal("")),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["admin", "manager", "support", "user"]).default("user"),
});
