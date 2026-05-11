/**
 * Allows lead, operation, AND teacher roles.
 */
import type { Request, Response, NextFunction } from "express";
import { verifyAnyAdminToken } from "../lib/auth.js";

export function staffOnly(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "ต้องล็อกอินก่อน" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyAnyAdminToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: "Token ไม่ถูกต้องหรือหมดอายุ" });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).adminPayload = payload;
  next();
}
