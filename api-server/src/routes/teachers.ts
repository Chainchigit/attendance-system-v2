import { Router, type IRouter } from "express";
import { adminOnly } from "../middleware/adminOnly.js";
import { leadOnly } from "../middleware/leadOnly.js";

const router: IRouter = Router();

/** GET /api/teachers — list all teacher accounts (admin: lead + operation) */
router.get("/teachers", adminOnly, async (req, res) => {
  try {
    const { db } = await import("@workspace/db");
    const { teachersTable } = await import("@workspace/db/schema");
    const teachers = await db
      .select({
        id:          teachersTable.id,
        username:    teachersTable.username,
        displayName: teachersTable.displayName,
        faculty:     teachersTable.faculty,
        department:  teachersTable.department,
        subject:     teachersTable.subject,
        createdAt:   teachersTable.createdAt,
      })
      .from(teachersTable)
      .orderBy(teachersTable.createdAt);
    res.json({ success: true, teachers });
  } catch (err) {
    req.log.error({ err }, "Error fetching teachers");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด" });
  }
});

/** POST /api/teachers — create teacher account (admin: lead + operation) */
router.post("/teachers", adminOnly, async (req, res) => {
  const { username, password, displayName, faculty, department, subject } = req.body;

  if (!username || !password || !displayName || !faculty || !department) {
    res.status(400).json({ success: false, error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    return;
  }

  const u  = String(username).trim();
  const pw = String(password).trim();
  const dn = String(displayName).trim();
  const fc = String(faculty).trim();
  const dp = String(department).trim();
  const sb = subject ? String(subject).trim() : "";

  if (u.length < 2) {
    res.status(400).json({ success: false, error: "ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร" });
    return;
  }
  if (pw.length < 4) {
    res.status(400).json({ success: false, error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const { teachersTable } = await import("@workspace/db/schema");

    const [teacher] = await db
      .insert(teachersTable)
      .values({ username: u, password: pw, displayName: dn, faculty: fc, department: dp, subject: sb })
      .returning();

    res.status(201).json({ success: true, teacher });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({ success: false, error: `ชื่อผู้ใช้ "${u}" มีอยู่ในระบบแล้ว` });
      return;
    }
    req.log.error({ err }, "Error creating teacher");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด" });
  }
});

/** PUT /api/teachers/:id — update teacher account (admin: lead + operation) */
router.put("/teachers/:id", adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: "ID ไม่ถูกต้อง" });
    return;
  }

  const { username, password, displayName, faculty, department, subject } = req.body;
  const { db } = await import("@workspace/db");
  const { teachersTable } = await import("@workspace/db/schema");
  const { eq } = await import("drizzle-orm");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (username    !== undefined) updates.username    = String(username).trim();
  if (displayName !== undefined) updates.displayName = String(displayName).trim();
  if (faculty     !== undefined) updates.faculty     = String(faculty).trim();
  if (department  !== undefined) updates.department  = String(department).trim();
  if (subject     !== undefined) updates.subject     = String(subject).trim();
  if (password    !== undefined && String(password).trim().length >= 4)
    updates.password = String(password).trim();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, error: "ไม่มีข้อมูลที่ต้องการอัปเดต" });
    return;
  }
  if (updates.username && updates.username.length < 2) {
    res.status(400).json({ success: false, error: "ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร" });
    return;
  }

  try {
    const [updated] = await db
      .update(teachersTable)
      .set(updates)
      .where(eq(teachersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: "ไม่พบบัญชีอาจารย์" });
      return;
    }
    res.json({ success: true, teacher: updated });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      res.status(409).json({ success: false, error: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว" });
      return;
    }
    req.log.error({ err }, "Error updating teacher");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด" });
  }
});

/** DELETE /api/teachers/:id — delete teacher account (lead only) */
router.delete("/teachers/:id", leadOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: "ID ไม่ถูกต้อง" });
    return;
  }

  try {
    const { db } = await import("@workspace/db");
    const { teachersTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");

    const [deleted] = await db
      .delete(teachersTable)
      .where(eq(teachersTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ success: false, error: "ไม่พบบัญชีอาจารย์" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting teacher");
    res.status(500).json({ success: false, error: "เกิดข้อผิดพลาด" });
  }
});

export default router;
