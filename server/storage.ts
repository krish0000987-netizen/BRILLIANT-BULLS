import {
  type User,
  type Device,
  type AuditLog,
  type EncryptedCredential,
  type CsvConfig,
  type Subscription,
  type AlgoLog,
  users,
  devices,
  auditLogs,
  encryptedCredentials,
  csvConfigs,
  subscriptions,
  algoLogs,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: { username: string; password: string; email?: string; firstName?: string; lastName?: string; phone?: string; role?: string }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  createDevice(data: Omit<Device, "id" | "createdAt">): Promise<Device>;
  getUserDevices(userId: string): Promise<Device[]>;
  getDeviceByFingerprint(userId: string, fingerprint: string): Promise<Device | undefined>;
  updateDevice(id: string, updates: Partial<Device>): Promise<void>;
  deleteDevice(id: string): Promise<void>;

  createAuditLog(data: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
  getUserAuditLogs(userId: string): Promise<AuditLog[]>;
  getAllAuditLogs(): Promise<(AuditLog & { userName?: string | null })[]>;

  createCredential(data: Omit<EncryptedCredential, "id" | "createdAt" | "updatedAt">): Promise<EncryptedCredential>;
  getUserCredentials(userId: string): Promise<EncryptedCredential[]>;
  getCredential(id: string): Promise<EncryptedCredential | undefined>;
  deleteCredential(id: string): Promise<void>;

  createCsvConfig(data: Omit<CsvConfig, "id" | "createdAt" | "updatedAt">): Promise<CsvConfig>;
  getUserCsvConfigs(userId: string): Promise<CsvConfig[]>;
  getCsvConfig(id: string): Promise<CsvConfig | undefined>;
  deleteCsvConfig(id: string): Promise<void>;

  getSubscription(userId: string): Promise<Subscription | undefined>;
  createSubscription(data: Omit<Subscription, "id" | "createdAt" | "updatedAt">): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined>;
  getAllSubscriptions(): Promise<(Subscription & { username?: string | null; firstName?: string | null })[]>;

  createAlgoLog(data: { userId?: string | null; runId?: string; level: string; message: string }): Promise<void>;
  getUserAlgoLogs(userId: string, limit?: number): Promise<AlgoLog[]>;
  getAllAlgoLogs(limit?: number): Promise<(AlgoLog & { username?: string | null })[]>;
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

  async createUser(data: { username: string; password: string; email?: string; firstName?: string; lastName?: string; phone?: string; role?: string }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [user] = await db.insert(users).values({
      username: data.username,
      password: hashedPassword,
      email: data.email || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      phone: data.phone || null,
      role: data.role || "user",
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
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
    return db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(100);
  }

  async getAllAuditLogs(): Promise<(AuditLog & { userName?: string | null })[]> {
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
        userName: users.firstName,
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
    return db.select().from(encryptedCredentials).where(eq(encryptedCredentials.userId, userId)).orderBy(desc(encryptedCredentials.createdAt));
  }

  async getCredential(id: string): Promise<EncryptedCredential | undefined> {
    const [cred] = await db.select().from(encryptedCredentials).where(eq(encryptedCredentials.id, id));
    return cred || undefined;
  }

  async deleteCredential(id: string): Promise<void> {
    await db.delete(encryptedCredentials).where(eq(encryptedCredentials.id, id));
  }

  async createCsvConfig(data: Omit<CsvConfig, "id" | "createdAt" | "updatedAt">): Promise<CsvConfig> {
    const [config] = await db.insert(csvConfigs).values(data).returning();
    return config;
  }

  async getUserCsvConfigs(userId: string): Promise<CsvConfig[]> {
    return db.select().from(csvConfigs).where(eq(csvConfigs.userId, userId)).orderBy(desc(csvConfigs.createdAt));
  }

  async getCsvConfig(id: string): Promise<CsvConfig | undefined> {
    const [config] = await db.select().from(csvConfigs).where(eq(csvConfigs.id, id));
    return config || undefined;
  }

  async deleteCsvConfig(id: string): Promise<void> {
    await db.delete(csvConfigs).where(eq(csvConfigs.id, id));
  }

  async getSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt)).limit(1);
    return sub || undefined;
  }

  async createSubscription(data: Omit<Subscription, "id" | "createdAt" | "updatedAt">): Promise<Subscription> {
    const [sub] = await db.insert(subscriptions).values(data).returning();
    return sub;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined> {
    const [sub] = await db.update(subscriptions).set({ ...updates, updatedAt: new Date() }).where(eq(subscriptions.id, id)).returning();
    return sub || undefined;
  }

  async getAllSubscriptions(): Promise<(Subscription & { username?: string | null; firstName?: string | null })[]> {
    const results = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        plan: subscriptions.plan,
        status: subscriptions.status,
        amount: subscriptions.amount,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        trialStartedAt: subscriptions.trialStartedAt,
        cancelledAt: subscriptions.cancelledAt,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        username: users.username,
        firstName: users.firstName,
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .orderBy(desc(subscriptions.createdAt));
    return results;
  }

  async createAlgoLog(data: { userId?: string | null; runId?: string; level: string; message: string }): Promise<void> {
    await db.insert(algoLogs).values(data);
  }

  async getUserAlgoLogs(userId: string, limit = 500): Promise<AlgoLog[]> {
    return db.select().from(algoLogs).where(eq(algoLogs.userId, userId)).orderBy(desc(algoLogs.loggedAt)).limit(limit);
  }

  async getAllAlgoLogs(limit = 500): Promise<(AlgoLog & { username?: string | null })[]> {
    const results = await db
      .select({
        id: algoLogs.id,
        userId: algoLogs.userId,
        runId: algoLogs.runId,
        level: algoLogs.level,
        message: algoLogs.message,
        loggedAt: algoLogs.loggedAt,
        username: users.username,
      })
      .from(algoLogs)
      .leftJoin(users, eq(algoLogs.userId, users.id))
      .orderBy(desc(algoLogs.loggedAt))
      .limit(limit);
    return results;
  }
}

export const storage = new DatabaseStorage();
