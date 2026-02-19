import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { UAParser } from "ua-parser-js";
import multer from "multer";
import crypto from "crypto";
import { signupSchema, loginSchema, resetPasswordRequestSchema, resetPasswordSchema } from "@shared/schema";
import { encrypt, decrypt, hashToken, generateToken } from "./encryption";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  return secret;
}

function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const session = await storage.getSessionByRefreshToken(hashToken(refreshToken));
      if (session) {
        const inactiveTime = Date.now() - new Date(session.lastActivityAt).getTime();
        if (inactiveTime > INACTIVITY_TIMEOUT_MS) {
          await storage.deleteSession(session.id);
          res.clearCookie("accessToken");
          res.clearCookie("refreshToken", { path: "/api/auth" });
          return res.status(401).json({ message: "Session timed out due to inactivity" });
        }
        await storage.updateSessionActivity(session.id);
      }
    }

    next();
  } catch {
    return res.status(401).json({ message: "Token expired or invalid" });
  }
}

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}

function getDeviceFingerprint(req: Request): string {
  const ua = req.headers["user-agent"] || "";
  const ip = getClientIp(req);
  return crypto.createHash("md5").update(`${ua}-${ip}`).digest("hex");
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(cookieParser());

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
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { message: "Too many login attempts. Please try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { message: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/", apiLimiter);

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
      await storage.updateDevice(existing.id, {
        lastSeenAt: new Date(),
        ipAddress: ip,
      });
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

  function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: "/api/auth",
    });
  }

  // ── Auth Routes ───────────────────────────────────────────────────────

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }
      const { username, email, password, fullName } = parsed.data;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        fullName,
      });

      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = generateRefreshToken();

      await storage.createSession({
        userId: user.id,
        refreshToken: hashToken(refreshToken),
        deviceId: getDeviceFingerprint(req),
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
      });

      setTokenCookies(res, accessToken, refreshToken);
      await trackDevice(user.id, req);
      await logAudit(user.id, "User registered", "auth", req);

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (err: any) {
      console.error("Signup error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const { username, password } = parsed.data;

      const user = await storage.getUserByUsername(username);
      if (!user || !user.password) {
        await logAudit(null, "Failed login attempt", "auth", req, "warning", `Username: ${username}`);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      if (!user.isActive) {
        await logAudit(user.id, "Login attempt on disabled account", "auth", req, "warning");
        return res.status(403).json({ message: "Account has been disabled. Contact support." });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await logAudit(user.id, "Failed login - wrong password", "auth", req, "warning");
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = generateRefreshToken();

      await storage.createSession({
        userId: user.id,
        refreshToken: hashToken(refreshToken),
        deviceId: getDeviceFingerprint(req),
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
      });

      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      setTokenCookies(res, accessToken, refreshToken);
      await trackDevice(user.id, req);
      await logAudit(user.id, "User logged in", "auth", req);

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        const session = await storage.getSessionByRefreshToken(hashToken(refreshToken));
        if (session) {
          await storage.deleteSession(session.id);
        }
      }
      await logAudit(req.userId!, "User logged out", "auth", req);
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken", { path: "/api/auth" });
      res.json({ message: "Logged out" });
    } catch {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken", { path: "/api/auth" });
      res.json({ message: "Logged out" });
    }
  });

  app.get("/api/auth/me", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ message: "No refresh token" });
      }

      const session = await storage.getSessionByRefreshToken(hashToken(refreshToken));
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ message: "Session expired" });
      }

      const inactiveTime = Date.now() - new Date(session.lastActivityAt).getTime();
      if (inactiveTime > INACTIVITY_TIMEOUT_MS) {
        await storage.deleteSession(session.id);
        return res.status(401).json({ message: "Session timed out due to inactivity" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const accessToken = generateAccessToken(user.id, user.role);
      await storage.updateSessionActivity(session.id);

      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
      });

      const { password, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const parsed = resetPasswordRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid email" });
      }

      const user = await storage.getUserByEmail(parsed.data.email);
      if (user) {
        const token = generateToken();
        await storage.createPasswordResetToken({
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          usedAt: null,
        });
        await logAudit(user.id, "Password reset requested", "auth", req);
        console.log(`[Password Reset] Token for ${user.email}: ${token}`);
      }

      res.json({ message: "If an account exists, a reset link has been sent." });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }

      const tokenRecord = await storage.getPasswordResetToken(hashToken(parsed.data.token));
      if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const hashedPassword = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
      await storage.updateUser(tokenRecord.userId, { password: hashedPassword });
      await storage.markTokenUsed(tokenRecord.id);
      await storage.deleteUserSessions(tokenRecord.userId);
      await logAudit(tokenRecord.userId, "Password reset completed", "auth", req);

      res.json({ message: "Password has been reset. Please log in." });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "Invalid input. Password must be at least 8 characters." });
      }

      const user = await storage.getUser(req.userId!);
      if (!user || !user.password) {
        return res.status(400).json({ message: "Cannot change password for this account" });
      }

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        await logAudit(req.userId!, "Failed password change - wrong current password", "auth", req, "warning");
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await storage.updateUser(req.userId!, { password: hashedPassword });
      await logAudit(req.userId!, "Password changed", "auth", req);

      res.json({ message: "Password updated successfully" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Dashboard ─────────────────────────────────────────────────────────

  app.get("/api/dashboard/stats", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const [devicesList, sessionsList, credentialsList, logs] = await Promise.all([
        storage.getUserDevices(userId),
        storage.getUserSessions(userId),
        storage.getUserCredentials(userId),
        storage.getUserAuditLogs(userId),
      ]);

      const suspiciousEvents = logs.filter((l) => l.severity === "warning" || l.severity === "error" || l.severity === "critical").length;

      res.json({
        totalDevices: devicesList.length,
        totalSessions: sessionsList.length,
        totalCredentials: credentialsList.length,
        suspiciousEvents,
        recentLogins: logs.filter((l) => l.action.includes("logged in")).length,
        recentAuditLogs: logs.slice(0, 10),
      });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Devices ───────────────────────────────────────────────────────────

  app.get("/api/devices", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const devicesList = await storage.getUserDevices(req.userId!);
      res.json(devicesList);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/devices/:id/trust", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      await storage.updateDevice(req.params.id, { isTrusted: true });
      await logAudit(req.userId!, "Device marked as trusted", "security", req);
      res.json({ message: "Device trusted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/devices/:id", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteDevice(req.params.id);
      await logAudit(req.userId!, "Device removed", "security", req);
      res.json({ message: "Device removed" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Credentials ───────────────────────────────────────────────────────

  app.get("/api/credentials", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const creds = await storage.getUserCredentials(req.userId!);
      res.json(creds);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/credentials", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const { credentialType, value, label } = req.body;
      if (!credentialType || !value) {
        return res.status(400).json({ message: "Type and value are required" });
      }

      const { encrypted, iv, authTag } = encrypt(value);
      const cred = await storage.createCredential({
        userId: req.userId!,
        credentialType,
        encryptedValue: encrypted,
        iv,
        authTag,
        label: label || null,
      });

      await logAudit(req.userId!, `Credential stored: ${credentialType}`, "credentials", req);
      res.json(cred);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/credentials/:id/decrypt", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const cred = await storage.getCredential(req.params.id);
      if (!cred || cred.userId !== req.userId) {
        return res.status(404).json({ message: "Credential not found" });
      }

      const decrypted = decrypt(cred.encryptedValue, cred.iv, cred.authTag);
      await logAudit(req.userId!, `Credential decrypted: ${cred.credentialType}`, "credentials", req, "info", `Label: ${cred.label}`);

      res.json({ value: decrypted });
    } catch {
      res.status(500).json({ message: "Failed to decrypt credential" });
    }
  });

  app.delete("/api/credentials/:id", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const cred = await storage.getCredential(req.params.id);
      if (!cred || cred.userId !== req.userId) {
        return res.status(404).json({ message: "Credential not found" });
      }
      await storage.deleteCredential(req.params.id);
      await logAudit(req.userId!, `Credential deleted: ${cred.credentialType}`, "credentials", req);
      res.json({ message: "Credential deleted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Audit Logs ────────────────────────────────────────────────────────

  app.get("/api/audit-logs", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const logs = await storage.getUserAuditLogs(req.userId!);
      res.json(logs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── CSV Config ────────────────────────────────────────────────────────

  app.get("/api/csv-configs", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const configs = await storage.getUserCsvConfigs(req.userId!);
      res.json(configs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/csv-configs/upload", authMiddleware as any, upload.single("file"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const content = req.file.buffer.toString("utf-8");
      const { encrypted, iv, authTag } = encrypt(content);

      const config = await storage.createCsvConfig({
        userId: req.userId!,
        fileName: req.file.originalname,
        encryptedContent: encrypted,
        iv,
        authTag,
      });

      await logAudit(req.userId!, `CSV config uploaded: ${req.file.originalname}`, "config", req);
      res.json(config);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/csv-configs/:id/download", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const config = await storage.getCsvConfig(req.params.id);
      if (!config || config.userId !== req.userId) {
        return res.status(404).json({ message: "Config not found" });
      }

      const decrypted = decrypt(config.encryptedContent, config.iv, config.authTag);
      await logAudit(req.userId!, `CSV config downloaded: ${config.fileName}`, "config", req);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${config.fileName}"`);
      res.send(decrypted);
    } catch {
      res.status(500).json({ message: "Failed to decrypt config" });
    }
  });

  app.delete("/api/csv-configs/:id", authMiddleware as any, async (req: AuthRequest, res: Response) => {
    try {
      const config = await storage.getCsvConfig(req.params.id);
      if (!config || config.userId !== req.userId) {
        return res.status(404).json({ message: "Config not found" });
      }
      await storage.deleteCsvConfig(req.params.id);
      await logAudit(req.userId!, `CSV config deleted: ${config.fileName}`, "config", req);
      res.json({ message: "Config deleted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Admin Routes ──────────────────────────────────────────────────────

  app.get("/api/admin/users", authMiddleware as any, requireRole("admin", "manager") as any, async (req: AuthRequest, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(({ password, ...rest }) => rest);
      res.json(safeUsers);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/users/:id", authMiddleware as any, requireRole("admin", "manager") as any, async (req: AuthRequest, res: Response) => {
    try {
      const { isActive, role } = req.body;
      const updates: any = {};
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (role) updates.role = role;

      const updated = await storage.updateUser(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      await logAudit(req.userId!, `Admin updated user ${req.params.id}`, "admin", req, "info", JSON.stringify(updates));

      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/logs", authMiddleware as any, requireRole("admin", "manager") as any, async (req: AuthRequest, res: Response) => {
    try {
      const logs = await storage.getAllAuditLogs();
      res.json(logs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Session cleanup ───────────────────────────────────────────────────
  setInterval(async () => {
    try {
      await storage.deleteExpiredSessions();
    } catch {}
  }, 60 * 60 * 1000);

  return httpServer;
}
