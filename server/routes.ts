import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { UAParser } from "ua-parser-js";
import multer from "multer";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { encrypt, decrypt } from "./encryption";
import { setupAuth, isAuthenticated, isAdmin } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import { algoRunner } from "./algoRunner";

interface AuthRequest extends Request {
  user?: any;
}

function isWithinISTTradingHours(): { allowed: boolean; message: string } {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = istTime.getHours();
  const minute = istTime.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const day = istTime.getDay();

  if (day === 0 || day === 6) {
    return { allowed: false, message: "Not available on weekends. Trading hours are Mon-Fri 9:00 AM – 3:00 PM IST." };
  }
  if (totalMinutes < 540 || totalMinutes >= 900) {
    return { allowed: false, message: "Only available between 9:00 AM and 3:00 PM IST." };
  }
  return { allowed: true, message: "" };
}

function getUserId(req: AuthRequest): string {
  return req.user?.id;
}

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}

function getDeviceFingerprint(req: Request): string {
  const ua = req.headers["user-agent"] || "";
  const ip = getClientIp(req);
  return crypto.createHash("md5").update(`${ua}-${ip}`).digest("hex");
}

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function hasActiveSubscription(sub: any): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return false;
  if (sub.endDate && new Date(sub.endDate) < new Date()) return false;
  return true;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    })
  );

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { message: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many login attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/", apiLimiter);
  app.use("/api/login", loginLimiter);

  async function logAudit(userId: string | null, action: string, category: string, req: Request, severity = "info", details?: string) {
    try {
      await storage.createAuditLog({
        userId,
        action,
        category,
        details: details || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        severity,
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }
  }

  async function trackDevice(userId: string, req: Request) {
    const fingerprint = getDeviceFingerprint(req);
    const parser = new UAParser(req.headers["user-agent"]);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const ip = getClientIp(req);

    const existing = await storage.getDeviceByFingerprint(userId, fingerprint);
    if (existing) {
      await storage.updateDevice(existing.id, { lastSeenAt: new Date(), ipAddress: ip });
    } else {
      await storage.createDevice({
        userId,
        deviceFingerprint: fingerprint,
        browserName: browser.name || null,
        browserVersion: browser.version || null,
        osName: os.name || null,
        osVersion: os.version || null,
        ipAddress: ip,
        country: null,
        city: null,
        isTrusted: false,
        lastSeenAt: new Date(),
      });
      await logAudit(userId, "New device login detected", "security", req, "warning", `${browser.name} on ${os.name}`);
    }
  }

  // ── Public Sign Up ───────────────────────────────────────────────────
  app.post("/api/register", loginLimiter, async (req: Request, res: Response) => {
    try {
      const { username, password, email, firstName, lastName, phone } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const allUsers = await storage.getAllUsers();
      const assignedRole = allUsers.length === 0 ? "admin" : "user";

      const user = await storage.createUser({ username, password, email, firstName, lastName, phone, role: assignedRole });
      await logAudit(user.id, "User registered", "auth", req);

      (req as any).session.userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  // ── One-time admin fix: promote user by username ──────────────────────
  app.post("/api/fix-admin", async (req: Request, res: Response) => {
    try {
      const { username } = req.body || {};
      const allUsers = await storage.getAllUsers();
      if (allUsers.length === 0) {
        return res.status(400).json({ message: "No users exist" });
      }
      const admins = allUsers.filter(u => u.role === "admin");
      if (admins.length > 0) {
        return res.json({ message: "Admin already exists", admin: admins[0].username });
      }
      const target = username
        ? allUsers.find(u => u.username === username)
        : allUsers.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())[0];
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }
      const updated = await storage.updateUser(target.id, { role: "admin" });
      res.json({ message: "Promoted to admin", username: updated?.username, role: updated?.role });
    } catch (err: any) {
      console.error("fix-admin error:", err);
      res.status(500).json({ message: "Failed", error: err.message });
    }
  });

  // ── Subscription check middleware ──────────────────────────────────────
  const requireSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = req.user;
    if (user?.role === "admin" || user?.role === "manager") return next();

    const sub = await storage.getSubscription(userId);
    if (!hasActiveSubscription(sub)) {
      return res.status(403).json({ message: "Active subscription required. Please subscribe to access this feature." });
    }
    next();
  };

  // ── Subscription Routes ────────────────────────────────────────────────

  app.get("/api/subscription", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const sub = await storage.getSubscription(getUserId(req));
      res.json(sub || null);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/subscription/start-trial", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      const existing = await storage.getSubscription(userId);
      if (existing && existing.trialStartedAt) {
        return res.status(400).json({ message: "You have already used your free trial." });
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      if (existing) {
        const updated = await storage.updateSubscription(existing.id, {
          plan: "trial",
          status: "active",
          amount: 0,
          startDate: now,
          endDate,
          trialStartedAt: now,
        });
        await logAudit(userId, "Started free trial", "subscription", req);
        return res.json(updated);
      }

      const sub = await storage.createSubscription({
        userId,
        plan: "trial",
        status: "active",
        amount: 0,
        startDate: now,
        endDate,
        trialStartedAt: now,
        cancelledAt: null,
      });
      await logAudit(userId, "Started free trial", "subscription", req);
      res.json(sub);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/subscription/buy", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      const { plan } = req.body;

      const planMap: Record<string, { days: number; amount: number }> = {
        monthly: { days: 30, amount: 1000 },
        quarterly: { days: 90, amount: 2000 },
        yearly: { days: 365, amount: 10000 },
      };

      if (!planMap[plan]) {
        return res.status(400).json({ message: "Invalid plan. Choose monthly, quarterly, or yearly." });
      }

      const { days, amount } = planMap[plan];
      const now = new Date();
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const existing = await storage.getSubscription(userId);
      if (existing) {
        const updated = await storage.updateSubscription(existing.id, {
          plan,
          status: "active",
          amount,
          startDate: now,
          endDate,
          cancelledAt: null,
        });
        await logAudit(userId, `Subscribed to ${plan} plan (₹${amount})`, "subscription", req);
        return res.json(updated);
      }

      const sub = await storage.createSubscription({
        userId,
        plan,
        status: "active",
        amount,
        startDate: now,
        endDate,
        trialStartedAt: null,
        cancelledAt: null,
      });
      await logAudit(userId, `Subscribed to ${plan} plan (₹${amount})`, "subscription", req);
      res.json(sub);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Dashboard ─────────────────────────────────────────────────────────

  app.get("/api/dashboard/stats", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      await trackDevice(userId, req);
      const [devicesList, credentialsList, logs, sub] = await Promise.all([
        storage.getUserDevices(userId),
        storage.getUserCredentials(userId),
        storage.getUserAuditLogs(userId),
        storage.getSubscription(userId),
      ]);

      const suspiciousEvents = logs.filter((l) => l.severity === "warning" || l.severity === "error" || l.severity === "critical").length;

      res.json({
        totalDevices: devicesList.length,
        totalCredentials: credentialsList.length,
        suspiciousEvents,
        recentLogins: logs.filter((l) => l.action.includes("logged in") || l.action.includes("login")).length,
        recentAuditLogs: logs.slice(0, 10),
        subscription: sub || null,
      });
    } catch (err) {
      console.error("Dashboard error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Devices ───────────────────────────────────────────────────────────

  app.get("/api/devices", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      res.json(await storage.getUserDevices(getUserId(req)));
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/devices/:id/trust", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      await storage.updateDevice(paramId(req), { isTrusted: true });
      await logAudit(getUserId(req), "Device marked as trusted", "security", req);
      res.json({ message: "Device trusted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/devices/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteDevice(paramId(req));
      await logAudit(getUserId(req), "Device removed", "security", req);
      res.json({ message: "Device removed" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Credentials ───────────────────────────────────────────────────────

  app.get("/api/credentials", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      res.json(await storage.getUserCredentials(getUserId(req)));
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/credentials", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const { credentialType, value, label } = req.body;
      if (!credentialType || !value) {
        return res.status(400).json({ message: "Type and value are required" });
      }
      const { encrypted, iv, authTag } = encrypt(value);
      const cred = await storage.createCredential({
        userId: getUserId(req),
        credentialType,
        encryptedValue: encrypted,
        iv,
        authTag,
        label: label || null,
      });
      await logAudit(getUserId(req), `Credential stored: ${credentialType}`, "credentials", req);
      res.json(cred);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/credentials/:id/decrypt", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const cred = await storage.getCredential(paramId(req));
      if (!cred || cred.userId !== getUserId(req)) {
        return res.status(404).json({ message: "Credential not found" });
      }
      const decrypted = decrypt(cred.encryptedValue, cred.iv, cred.authTag);
      await logAudit(getUserId(req), `Credential decrypted: ${cred.credentialType}`, "credentials", req, "info", `Label: ${cred.label}`);
      res.json({ value: decrypted });
    } catch {
      res.status(500).json({ message: "Failed to decrypt credential" });
    }
  });

  app.delete("/api/credentials/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const cred = await storage.getCredential(paramId(req));
      if (!cred || cred.userId !== getUserId(req)) {
        return res.status(404).json({ message: "Credential not found" });
      }
      await storage.deleteCredential(paramId(req));
      await logAudit(getUserId(req), `Credential deleted: ${cred.credentialType}`, "credentials", req);
      res.json({ message: "Credential deleted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Audit Logs ────────────────────────────────────────────────────────

  app.get("/api/audit-logs", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      res.json(await storage.getUserAuditLogs(getUserId(req)));
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── CSV Config ────────────────────────────────────────────────────────

  app.get("/api/csv-configs", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      res.json(await storage.getUserCsvConfigs(getUserId(req)));
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/csv-configs/upload", isAuthenticated, upload.single("file") as any, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const content = req.file.buffer.toString("utf-8");
      const { encrypted, iv, authTag } = encrypt(content);
      const config = await storage.createCsvConfig({
        userId: getUserId(req),
        fileName: req.file.originalname,
        encryptedContent: encrypted,
        iv,
        authTag,
      });
      await logAudit(getUserId(req), `CSV config uploaded: ${req.file.originalname}`, "config", req);
      res.json(config);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/csv-configs/:id/download", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const config = await storage.getCsvConfig(paramId(req));
      if (!config || config.userId !== getUserId(req)) {
        return res.status(404).json({ message: "Config not found" });
      }
      const decrypted = decrypt(config.encryptedContent, config.iv, config.authTag);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${config.fileName}"`);
      res.send(decrypted);
    } catch {
      res.status(500).json({ message: "Failed to decrypt config" });
    }
  });

  app.delete("/api/csv-configs/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const config = await storage.getCsvConfig(paramId(req));
      if (!config || config.userId !== getUserId(req)) {
        return res.status(404).json({ message: "Config not found" });
      }
      await storage.deleteCsvConfig(paramId(req));
      await logAudit(getUserId(req), `CSV config deleted: ${config.fileName}`, "config", req);
      res.json({ message: "Config deleted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Admin Routes ──────────────────────────────────────────────────────

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const totalUsers = allUsers.length;
      const activeUsers = allUsers.filter(u => u.isActive).length;
      const adminCount = allUsers.filter(u => u.role === "admin").length;

      const subs = await Promise.all(allUsers.map(u => storage.getSubscription(u.id)));
      const activeSubs = subs.filter(s => s && s.status === "active" && s.endDate && new Date(s.endDate) > new Date()).length;
      const trialSubs = subs.filter(s => s && s.plan === "trial" && s.status === "active").length;
      const paidSubs = subs.filter(s => s && s.plan !== "trial" && s.status === "active" && s.endDate && new Date(s.endDate) > new Date()).length;

      const allLogs = await storage.getAllAuditLogs();
      const recentLogs = allLogs.slice(0, 5);
      const recentUsers = allUsers
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 5)
        .map(u => ({ id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, role: u.role, createdAt: u.createdAt }));

      res.json({
        totalUsers,
        activeUsers,
        adminCount,
        activeSubs,
        trialSubs,
        paidSubs,
        recentLogs,
        recentUsers,
      });
    } catch {
      res.status(500).json({ message: "Failed to load admin stats" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithSubs = await Promise.all(
        allUsers.map(async (u) => {
          const sub = await storage.getSubscription(u.id);
          const { password: _, ...safeUser } = u;
          return { ...safeUser, subscription: sub || null };
        })
      );
      res.json(usersWithSubs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { username, password, email, firstName, lastName, phone, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({ username, password, email, firstName, lastName, phone, role });
      await logAudit(getUserId(req), `Admin created user: ${username}`, "admin", req);
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { isActive, role, password } = req.body;
      const updates: any = {};
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (role) updates.role = role;
      if (password) updates.password = await bcrypt.hash(password, 10);

      const updated = await storage.updateUser(paramId(req), updates);
      if (!updated) return res.status(404).json({ message: "User not found" });

      await logAudit(getUserId(req), `Admin updated user ${paramId(req)}`, "admin", req, "info", JSON.stringify({ isActive, role }));
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/logs", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      res.json(await storage.getAllAuditLogs());
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/algo-logs", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (userId) {
        res.json(await storage.getUserAlgoLogs(userId));
      } else {
        res.json(await storage.getAllAlgoLogs());
      }
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/subscriptions", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      res.json(await storage.getAllSubscriptions());
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/subscriptions/:userId", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.userId;
      const { plan, days } = req.body;

      const planMap: Record<string, { defaultDays: number; amount: number }> = {
        trial: { defaultDays: 3, amount: 0 },
        monthly: { defaultDays: 30, amount: 1000 },
        quarterly: { defaultDays: 90, amount: 2000 },
        yearly: { defaultDays: 365, amount: 10000 },
      };

      if (!planMap[plan]) return res.status(400).json({ message: "Invalid plan" });

      const { defaultDays, amount } = planMap[plan];
      const now = new Date();
      const endDate = new Date(now.getTime() + (days || defaultDays) * 24 * 60 * 60 * 1000);

      const existing = await storage.getSubscription(userId);
      if (existing) {
        const updated = await storage.updateSubscription(existing.id, {
          plan,
          status: "active",
          amount,
          startDate: now,
          endDate,
          cancelledAt: null,
          trialStartedAt: plan === "trial" ? now : existing.trialStartedAt,
        });
        await logAudit(getUserId(req), `Admin assigned ${plan} subscription to user ${userId}`, "admin", req);
        return res.json(updated);
      }

      const sub = await storage.createSubscription({
        userId,
        plan,
        status: "active",
        amount,
        startDate: now,
        endDate,
        trialStartedAt: plan === "trial" ? now : null,
        cancelledAt: null,
      });
      await logAudit(getUserId(req), `Admin assigned ${plan} subscription to user ${userId}`, "admin", req);
      res.json(sub);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/subscriptions/:userId/terminate", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.userId;
      const sub = await storage.getSubscription(userId);
      if (!sub) return res.status(404).json({ message: "No subscription found" });

      const updated = await storage.updateSubscription(sub.id, {
        status: "cancelled",
        cancelledAt: new Date(),
      });
      await logAudit(getUserId(req), `Admin terminated subscription for user ${userId}`, "admin", req, "warning");
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Algorithm Runner Routes ───────────────────────────────────────────

  algoRunner.setupScheduledJobs();

  app.get("/api/algo/status", isAuthenticated, async (req: AuthRequest, res: Response) => {
    const timeCheck = isWithinISTTradingHours();
    const now = new Date();
    const istTimeStr = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, weekday: "short" });
    res.json({ ...algoRunner.runInfo, tradingHoursActive: timeCheck.allowed, tradingHoursMessage: timeCheck.message, currentIST: istTimeStr });
  });

  app.post("/api/algo/start", isAuthenticated, requireSubscription as any, async (req: AuthRequest, res: Response) => {
    const timeCheck = isWithinISTTradingHours();
    if (!timeCheck.allowed) {
      return res.json({ success: false, message: timeCheck.message });
    }
    const result = algoRunner.start(true);
    await logAudit(getUserId(req), "Algorithm started (live)", "algo", req, result.success ? "info" : "warning", result.message);
    res.json(result);
  });

  app.post("/api/algo/start-test", isAuthenticated, async (req: AuthRequest, res: Response) => {
    const result = algoRunner.startTest();
    await logAudit(getUserId(req), "Algorithm started (test mode)", "algo", req, result.success ? "info" : "warning", result.message);
    res.json(result);
  });

  app.post("/api/algo/stop", isAuthenticated, async (req: AuthRequest, res: Response) => {
    const result = algoRunner.stop();
    await logAudit(getUserId(req), "Algorithm stopped", "algo", req, "info", result.message);
    res.json(result);
  });

  app.get("/api/algo/logs", isAuthenticated, async (req: AuthRequest, res: Response) => {
    res.json(algoRunner.logs);
  });

  app.get("/api/algo/logs/stream", isAuthenticated, async (req: AuthRequest, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    const existingLogs = algoRunner.logs;
    for (const log of existingLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }

    const remove = algoRunner.addListener((line) => {
      try { res.write(`data: ${JSON.stringify(line)}\n\n`); } catch {}
    });

    const heartbeat = setInterval(() => {
      try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); }
    }, 15000);

    req.on("close", () => {
      remove();
      clearInterval(heartbeat);
    });
  });

  app.post("/api/algo/upload-config", isAuthenticated, requireSubscription as any, upload.single("file") as any, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const content = req.file.buffer.toString("utf-8");
      const lines = content.trim().split("\n");

      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV must have a header row and at least one data row" });
      }

      const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
      if (headers.length < 3) {
        return res.status(400).json({ message: "CSV must have at least 3 columns" });
      }

      const configContent = lines.slice(0, 2).join("\n");
      algoRunner.saveConfig(configContent);

      const { encrypted, iv, authTag } = encrypt(configContent);
      await storage.createCsvConfig({
        userId: getUserId(req),
        fileName: req.file.originalname,
        encryptedContent: encrypted,
        iv,
        authTag,
      });

      await logAudit(getUserId(req), `Algo CSV config uploaded: ${req.file.originalname}`, "config", req);
      res.json({ success: true, message: "Config uploaded and saved" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to upload config" });
    }
  });

  app.delete("/api/algo/config", isAuthenticated, async (req: AuthRequest, res: Response) => {
    algoRunner.deleteConfig();
    await logAudit(getUserId(req), "Algo CSV config deleted", "config", req);
    res.json({ success: true, message: "Config deleted" });
  });

  return httpServer;
}
