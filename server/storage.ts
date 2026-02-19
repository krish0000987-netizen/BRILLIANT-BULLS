import {
  type User,
  type Device,
  type AuditLog,
  type EncryptedCredential,
  type CsvConfig,
  users,
  devices,
  auditLogs,
  encryptedCredentials,
  csvConfigs,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
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
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
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
