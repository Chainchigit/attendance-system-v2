/**
 * Allows any authenticated role: lead, operation, or teacher.
 */
import type { Request, Response, NextFunction } from "express";
import { verifyAnyAdminToken } from "../lib/auth.js";

export function anyAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "ต้องล็อกอินก่อน" });
    return;
  }
  const payload = verifyAnyAdminToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ success: false, error: "Token ไม่ถูกต้องหรือหมดอายุ" });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).adminPayload = payload;
  next();
}
