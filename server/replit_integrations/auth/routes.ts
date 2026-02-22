import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const { password: _, ...safeUser } = req.user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
