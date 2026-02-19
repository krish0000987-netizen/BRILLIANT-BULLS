import {
  type User,
  type InsertUser,
  type Session,
  type Device,
  type AuditLog,
  type EncryptedCredential,
  type PasswordResetToken,
  type CsvConfig,
  users,
  sessions,
  devices,
  auditLogs,
  encryptedCredentials,
  passwordResetTokens,
  csvConfigs,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, lt, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  createSession(data: Omit<Session, "id" | "createdAt">): Promise<Session>;
  getSessionByRefreshToken(token: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  updateSessionActivity(id: string): Promise<void>;
  getUserSessions(userId: string): Promise<Session[]>;
  deleteExpiredSessions(): Promise<void>;

  createDevice(data: Omit<Device, "id" | "createdAt">): Promise<Device>;
  getUserDevices(userId: string): Promise<Device[]>;
  getDeviceByFingerprint(userId: string, fingerprint: string): Promise<Device | undefined>;
  updateDevice(id: string, updates: Partial<Device>): Promise<void>;
  deleteDevice(id: string): Promise<void>;

  createAuditLog(data: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
  getUserAuditLogs(userId: string): Promise<AuditLog[]>;
  getAllAuditLogs(): Promise<(AuditLog & { userName?: string })[]>;

  createCredential(data: Omit<EncryptedCredential, "id" | "createdAt" | "updatedAt">): Promise<EncryptedCredential>;
  getUserCredentials(userId: string): Promise<EncryptedCredential[]>;
  getCredential(id: string): Promise<EncryptedCredential | undefined>;
  deleteCredential(id: string): Promise<void>;

  createPasswordResetToken(data: Omit<PasswordResetToken, "id" | "createdAt">): Promise<PasswordResetToken>;
  getPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(id: string): Promise<void>;

  createCsvConfig(data: Omit<CsvConfig, "id" | "createdAt" | "updatedAt">): Promise<CsvConfig>;
  getUserCsvConfigs(userId: string): Promise<CsvConfig[]>;
  getCsvConfig(id: string): Promise<CsvConfig | undefined>;
  deleteCsvConfig(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createSession(data: Omit<Session, "id" | "createdAt">): Promise<Session> {
    const [session] = await db.insert(sessions).values(data).returning();
    return session;
  }

  async getSessionByRefreshToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.refreshToken, token));
    return session || undefined;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async updateSessionActivity(id: string): Promise<void> {
    await db.update(sessions).set({ lastActivityAt: new Date() }).where(eq(sessions.id, id));
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return db.select().from(sessions).where(eq(sessions.userId, userId));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }

  async createDevice(data: Omit<Device, "id" | "createdAt">): Promise<Device> {
    const [device] = await db.insert(devices).values(data).returning();
    return device;
  }

  async getUserDevices(userId: string): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.userId, userId)).orderBy(desc(devices.lastSeenAt));
  }

  async getDeviceByFingerprint(userId: string, fingerprint: string): Promise<Device | undefined> {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), eq(devices.deviceFingerprint, fingerprint)));
    return device || undefined;
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<void> {
    await db.update(devices).set(updates).where(eq(devices.id, id));
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async createAuditLog(data: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  async getUserAuditLogs(userId: string): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
  }

  async getAllAuditLogs(): Promise<(AuditLog & { userName?: string })[]> {
    const results = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        category: auditLogs.category,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        severity: auditLogs.severity,
        createdAt: auditLogs.createdAt,
        userName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
    return results;
  }

  async createCredential(data: Omit<EncryptedCredential, "id" | "createdAt" | "updatedAt">): Promise<EncryptedCredential> {
    const [cred] = await db.insert(encryptedCredentials).values(data).returning();
    return cred;
  }

  async getUserCredentials(userId: string): Promise<EncryptedCredential[]> {
    return db
      .select()
      .from(encryptedCredentials)
      .where(eq(encryptedCredentials.userId, userId))
      .orderBy(desc(encryptedCredentials.createdAt));
  }

  async getCredential(id: string): Promise<EncryptedCredential | undefined> {
    const [cred] = await db.select().from(encryptedCredentials).where(eq(encryptedCredentials.id, id));
    return cred || undefined;
  }

  async deleteCredential(id: string): Promise<void> {
    await db.delete(encryptedCredentials).where(eq(encryptedCredentials.id, id));
  }

  async createPasswordResetToken(data: Omit<PasswordResetToken, "id" | "createdAt">): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(data).returning();
    return token;
  }

  async getPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const [token] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
    return token || undefined;
  }

  async markTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async createCsvConfig(data: Omit<CsvConfig, "id" | "createdAt" | "updatedAt">): Promise<CsvConfig> {
    const [config] = await db.insert(csvConfigs).values(data).returning();
    return config;
  }

  async getUserCsvConfigs(userId: string): Promise<CsvConfig[]> {
    return db
      .select()
      .from(csvConfigs)
      .where(eq(csvConfigs.userId, userId))
      .orderBy(desc(csvConfigs.createdAt));
  }

  async getCsvConfig(id: string): Promise<CsvConfig | undefined> {
    const [config] = await db.select().from(csvConfigs).where(eq(csvConfigs.id, id));
    return config || undefined;
  }

  async deleteCsvConfig(id: string): Promise<void> {
    await db.delete(csvConfigs).where(eq(csvConfigs.id, id));
  }
}

export const storage = new DatabaseStorage();
