import { Router, type IRouter } from "express";
import {
  verifyAdminCredentials,
  verifyTeacherFromDB,
  signAdminToken,
  verifyAdminToken,
  updateLeadCredentials,
  updateOperationPassword,
  updateTeacherCredentials,
  getLeadUsername,
  getTeacherUsername,
  type AdminRole,
} from "../lib/auth.js";
import { leadOnly } from "../middleware/leadOnly.js";
import { anyAuth } from "../middleware/anyAuth.js";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, error: "กรุณากรอก username และ password" });
    return;
  }

  const u = String(username);
  const p = String(password);

  // 1. Check lead / operation (in-memory)
  const inMemoryRole = verifyAdminCredentials(u, p);
  if (inMemoryRole === "lead" || inMemoryRole === "operation") {
    const token = signAdminToken(u, inMemoryRole);
    res.json({ success: true, token, role: inMemoryRole, username: u });
    return;
  }

  // 2. Check DB teachers table
  const dbTeacher = await verifyTeacherFromDB(u, p);
  if (dbTeacher) {
    const token = signAdminToken(u, "teacher", dbTeacher);
    res.json({
      success: true,
      token,
      role: "teacher" as AdminRole,
      username: u,
      displayName: dbTeacher.displayName,
      faculty: dbTeacher.faculty,
      department: dbTeacher.department,
      subject: dbTeacher.subject,
    });
    return;
  }

  // 3. Fall back to single in-memory teacher (legacy)
  if (inMemoryRole === "teacher") {
    const token = signAdminToken(u, "teacher");
    res.json({ success: true, token, role: "teacher" as AdminRole, username: u });
    return;
  }

  res.status(401).json({ success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
});

router.get("/auth/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ valid: false });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ valid: false });
    return;
  }
  res.json({ valid: true, role: payload.role, username: payload.username });
});

/** Lead can fetch the current Lead username (shown in Settings UI). */
router.get("/auth/lead-info", leadOnly, (req, res) => {
  res.json({ username: getLeadUsername() });
});

/**
 * Any authenticated role can change their OWN password (and username for Lead).
 * Body: { currentPassword, newPassword, confirmPassword, newUsername? }
 */
router.post("/auth/change-my-password", anyAuth, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (req as any).adminPayload as { username: string; role: AdminRole; teacherId?: number };

  const { currentPassword, newPassword, confirmPassword, newUsername } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" });
    return;
  }

  const trimmedNewPw = String(newPassword).trim();
  if (trimmedNewPw.length < 4) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" });
    return;
  }

  if (confirmPassword && String(confirmPassword).trim() !== trimmedNewPw) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" });
    return;
  }

  // ── DB teacher (teacherId present in JWT) ──────────────────────────────────
  if (payload.role === "teacher" && payload.teacherId) {
    try {
      const { db } = await import("@workspace/db");
      const { teachersTable } = await import("@workspace/db/schema");
      const { eq } = await import("drizzle-orm");

      const [teacher] = await db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.id, payload.teacherId))
        .limit(1);

      if (!teacher || teacher.password !== String(currentPassword)) {
        res.status(401).json({ success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
        return;
      }

      await db
        .update(teachersTable)
        .set({ password: trimmedNewPw })
        .where(eq(teachersTable.id, payload.teacherId));

      res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ กรุณาล็อกอินใหม่" });
      return;
    } catch (err) {
      req.log.error({ err }, "Error changing DB teacher password");
      res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      return;
    }
  }

  // ── Lead / Operation / legacy in-memory teacher ───────────────────────────
  if (!verifyAdminCredentials(payload.username, String(currentPassword))) {
    res.status(401).json({ success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    return;
  }

  try {
    if (payload.role === "lead") {
      const trimmedUsername = newUsername ? String(newUsername).trim() : null;
      if (trimmedUsername && trimmedUsername.length < 2) {
        res.status(400).json({ success: false, error: "ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร" });
        return;
      }
      await updateLeadCredentials(trimmedUsername, trimmedNewPw);
    } else if (payload.role === "operation") {
      await updateOperationPassword(trimmedNewPw);
    } else if (payload.role === "teacher") {
      await updateTeacherCredentials(null, trimmedNewPw);
    }
    res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ กรุณาล็อกอินใหม่" });
  } catch (err) {
    req.log.error({ err }, "Error changing own password");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

/**
 * Lead can update their own username and/or password.
 * Body: { currentPassword, newUsername?, newPassword?, confirmPassword? }
 */
router.post("/auth/change-credentials", leadOnly, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (req as any).adminPayload as { username: string; role: string };

  const { currentPassword, newUsername, newPassword, confirmPassword } = req.body;

  if (!currentPassword) {
    res.status(400).json({ success: false, error: "กรุณากรอกรหัสผ่านปัจจุบัน" });
    return;
  }

  // Verify with whatever the current lead username is stored in memory
  if (!verifyAdminCredentials(payload.username, String(currentPassword))) {
    res.status(401).json({ success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    return;
  }

  const trimmedUsername = newUsername ? String(newUsername).trim() : null;
  const trimmedPassword = newPassword ? String(newPassword).trim() : null;

  if (trimmedUsername !== null && trimmedUsername.length < 2) {
    res.status(400).json({ success: false, error: "ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร" });
    return;
  }

  if (trimmedPassword !== null) {
    if (trimmedPassword.length < 4) {
      res.status(400).json({ success: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" });
      return;
    }
    if (confirmPassword && String(confirmPassword).trim() !== trimmedPassword) {
      res.status(400).json({ success: false, error: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" });
      return;
    }
  }

  if (!trimmedUsername && !trimmedPassword) {
    res.status(400).json({ success: false, error: "กรุณากรอก username ใหม่ หรือ password ใหม่ อย่างน้อยหนึ่งอย่าง" });
    return;
  }

  try {
    await updateLeadCredentials(trimmedUsername, trimmedPassword);
    res.json({
      success: true,
      message: "อัปเดต credentials สำเร็จ",
      newUsername: trimmedUsername ?? undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Error updating lead credentials");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

/**
 * Lead can change the Operation account password.
 * Body: { currentLeadPassword, newPassword, confirmPassword }
 */
router.post("/auth/change-operation-password", leadOnly, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (req as any).adminPayload as { username: string; role: string };

  const { currentLeadPassword, newPassword, confirmPassword } = req.body;

  if (!currentLeadPassword || !newPassword) {
    res.status(400).json({ success: false, error: "กรุณากรอกรหัสผ่าน Lead และรหัสผ่าน Operation ใหม่" });
    return;
  }

  if (!verifyAdminCredentials(payload.username, String(currentLeadPassword))) {
    res.status(401).json({ success: false, error: "รหัสผ่าน Lead ไม่ถูกต้อง" });
    return;
  }

  const trimmed = String(newPassword).trim();
  if (trimmed.length < 4) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" });
    return;
  }

  if (confirmPassword && String(confirmPassword).trim() !== trimmed) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" });
    return;
  }

  try {
    await updateOperationPassword(trimmed);
    res.json({ success: true, message: "เปลี่ยนรหัสผ่าน Operation สำเร็จ" });
  } catch (err) {
    req.log.error({ err }, "Error updating operation password");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

/**
 * Lead can change the Teacher account credentials (username and/or password).
 * Body: { currentLeadPassword, newUsername?, newPassword?, confirmPassword? }
 */
router.get("/auth/teacher-info", leadOnly, (_req, res) => {
  res.json({ username: getTeacherUsername() });
});

router.post("/auth/change-teacher-credentials", leadOnly, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (req as any).adminPayload as { username: string; role: string };

  const { currentLeadPassword, newUsername, newPassword, confirmPassword } = req.body;

  if (!currentLeadPassword) {
    res.status(400).json({ success: false, error: "กรุณากรอกรหัสผ่าน Lead" });
    return;
  }

  if (!verifyAdminCredentials(payload.username, String(currentLeadPassword))) {
    res.status(401).json({ success: false, error: "รหัสผ่าน Lead ไม่ถูกต้อง" });
    return;
  }

  const trimmedUsername = newUsername ? String(newUsername).trim() : null;
  const trimmedPassword = newPassword ? String(newPassword).trim() : null;

  if (!trimmedUsername && !trimmedPassword) {
    res.status(400).json({ success: false, error: "กรุณากรอก username ใหม่ หรือ password ใหม่ อย่างน้อยหนึ่งอย่าง" });
    return;
  }

  if (trimmedUsername && trimmedUsername.length < 2) {
    res.status(400).json({ success: false, error: "ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร" });
    return;
  }

  if (trimmedPassword && trimmedPassword.length < 4) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" });
    return;
  }

  if (trimmedPassword && confirmPassword && String(confirmPassword).trim() !== trimmedPassword) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" });
    return;
  }

  try {
    await updateTeacherCredentials(trimmedUsername, trimmedPassword);
    res.json({ success: true, message: "อัปเดต credentials อาจารย์สำเร็จ" });
  } catch (err) {
    req.log.error({ err }, "Error updating teacher credentials");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

// Keep old endpoint for backward compat (delegates to change-credentials)
router.post("/auth/change-password", leadOnly, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (req as any).adminPayload as { username: string };
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: "กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" });
    return;
  }
  if (!verifyAdminCredentials(payload.username, String(currentPassword))) {
    res.status(401).json({ success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    return;
  }
  if (String(newPassword).length < 4) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" });
    return;
  }
  if (confirmPassword && String(newPassword) !== String(confirmPassword)) {
    res.status(400).json({ success: false, error: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน" });
    return;
  }
  try {
    await updateLeadCredentials(null, String(newPassword));
    res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (err) {
    req.log.error({ err }, "Error changing password");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
  }
});

export default router;
