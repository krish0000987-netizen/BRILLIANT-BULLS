import session from "express-session";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated. Contact admin." });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as any).user = user;
  next();
};

export const isAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
