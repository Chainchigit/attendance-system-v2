/**
 * Allows only the "lead" role.
 * Use for destructive or privileged operations (delete, change password).
 */
import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../lib/auth.js";

export function leadOnly(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "ต้องล็อกอินก่อน" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: "Token ไม่ถูกต้องหรือหมดอายุ" });
    return;
  }
  if (payload.role !== "lead") {
    res.status(403).json({ success: false, error: "สิทธิ์ไม่เพียงพอ — ต้องเป็น Lead เท่านั้น" });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).adminPayload = payload;
  next();
}
