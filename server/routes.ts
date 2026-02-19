import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { UAParser } from "ua-parser-js";
import multer from "multer";
import crypto from "crypto";
import { encrypt, decrypt } from "./encryption";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { algoRunner } from "./algoRunner";

interface AuthRequest extends Request {
  user?: any;
}

function getUserId(req: AuthRequest): string {
  return req.user?.claims?.sub;
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
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

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

  function requireRole(...roles: string[]) {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  app.get("/api/dashboard/stats", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      await trackDevice(userId, req);
      const [devicesList, credentialsList, logs] = await Promise.all([
        storage.getUserDevices(userId),
        storage.getUserCredentials(userId),
        storage.getUserAuditLogs(userId),
      ]);

      const suspiciousEvents = logs.filter((l) => l.severity === "warning" || l.severity === "error" || l.severity === "critical").length;

      res.json({
        totalDevices: devicesList.length,
        totalCredentials: credentialsList.length,
        suspiciousEvents,
        recentLogins: logs.filter((l) => l.action.includes("logged in") || l.action.includes("login")).length,
        recentAuditLogs: logs.slice(0, 10),
      });
    } catch (err) {
      console.error("Dashboard error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Devices ───────────────────────────────────────────────────────────

  app.get("/api/devices", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const devicesList = await storage.getUserDevices(getUserId(req));
      res.json(devicesList);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/devices/:id/trust", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      await storage.updateDevice(req.params.id, { isTrusted: true });
      await logAudit(getUserId(req), "Device marked as trusted", "security", req);
      res.json({ message: "Device trusted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/devices/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteDevice(req.params.id);
      await logAudit(getUserId(req), "Device removed", "security", req);
      res.json({ message: "Device removed" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Credentials ───────────────────────────────────────────────────────

  app.get("/api/credentials", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const creds = await storage.getUserCredentials(getUserId(req));
      res.json(creds);
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
      const cred = await storage.getCredential(req.params.id);
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
      const cred = await storage.getCredential(req.params.id);
      if (!cred || cred.userId !== getUserId(req)) {
        return res.status(404).json({ message: "Credential not found" });
      }
      await storage.deleteCredential(req.params.id);
      await logAudit(getUserId(req), `Credential deleted: ${cred.credentialType}`, "credentials", req);
      res.json({ message: "Credential deleted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Audit Logs ────────────────────────────────────────────────────────

  app.get("/api/audit-logs", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const logs = await storage.getUserAuditLogs(getUserId(req));
      res.json(logs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── CSV Config ────────────────────────────────────────────────────────

  app.get("/api/csv-configs", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const configs = await storage.getUserCsvConfigs(getUserId(req));
      res.json(configs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/csv-configs/upload", isAuthenticated, upload.single("file") as any, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

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
      const config = await storage.getCsvConfig(req.params.id);
      if (!config || config.userId !== getUserId(req)) {
        return res.status(404).json({ message: "Config not found" });
      }

      const decrypted = decrypt(config.encryptedContent, config.iv, config.authTag);
      await logAudit(getUserId(req), `CSV config downloaded: ${config.fileName}`, "config", req);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${config.fileName}"`);
      res.send(decrypted);
    } catch {
      res.status(500).json({ message: "Failed to decrypt config" });
    }
  });

  app.delete("/api/csv-configs/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const config = await storage.getCsvConfig(req.params.id);
      if (!config || config.userId !== getUserId(req)) {
        return res.status(404).json({ message: "Config not found" });
      }
      await storage.deleteCsvConfig(req.params.id);
      await logAudit(getUserId(req), `CSV config deleted: ${config.fileName}`, "config", req);
      res.json({ message: "Config deleted" });
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Admin Routes ──────────────────────────────────────────────────────

  app.get("/api/admin/users", isAuthenticated, requireRole("admin", "manager") as any, async (req: AuthRequest, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, requireRole("admin", "manager") as any, async (req: AuthRequest, res: Response) => {
    try {
      const { isActive, role } = req.body;
      const updates: any = {};
      if (typeof isActive === "boolean") updates.isActive = isActive;
      if (role) updates.role = role;

      const updated = await storage.updateUser(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      await logAudit(getUserId(req), `Admin updated user ${req.params.id}`, "admin", req, "info", JSON.stringify(updates));
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/logs", isAuthenticated, requireRole("admin", "manager") as any, async (req: AuthRequest, res: Response) => {
    try {
      const logs = await storage.getAllAuditLogs();
      res.json(logs);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Algorithm Runner Routes ───────────────────────────────────────────

  algoRunner.setupScheduledJobs();

  app.get("/api/algo/status", isAuthenticated, async (req: AuthRequest, res: Response) => {
    res.json(algoRunner.runInfo);
  });

  app.post("/api/algo/start", isAuthenticated, async (req: AuthRequest, res: Response) => {
    const result = algoRunner.start();
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
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const existingLogs = algoRunner.logs;
    for (const log of existingLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }

    const remove = algoRunner.addListener((line) => {
      try {
        res.write(`data: ${JSON.stringify(line)}\n\n`);
      } catch {}
    });

    req.on("close", () => {
      remove();
    });
  });

  app.post("/api/algo/upload-config", isAuthenticated, upload.single("file") as any, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

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
