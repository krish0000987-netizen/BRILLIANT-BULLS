import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export * from "./models/auth";
import { users } from "./models/auth";

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
