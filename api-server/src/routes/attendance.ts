import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable, usersTable } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { adminOnly } from "../middleware/adminOnly.js";

const router: IRouter = Router();

router.post("/attendance", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: "Name is required" });
      return;
    }

    const trimmedName = String(name).trim();

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.name, trimmedName))
      .limit(1);

    if (users.length === 0) {
      res.status(400).json({ success: false, error: `User "${trimmedName}" is not registered` });
      return;
    }

    const user = users[0];
    const today = new Date().toISOString().split("T")[0];

    const existingToday = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.userId, user.id),
          eq(attendanceTable.date, today)
        )
      )
      .orderBy(attendanceTable.timestamp);

    const requestedType = req.body.type;
    let attendanceType: "check_in" | "check_out";

    if (requestedType === "check_in" || requestedType === "check_out") {
      attendanceType = requestedType;
    } else {
      const lastRecord = existingToday[existingToday.length - 1];
      attendanceType = !lastRecord || lastRecord.type === "check_out" ? "check_in" : "check_out";
    }

    const [record] = await db
      .insert(attendanceTable)
      .values({
        userId: user.id,
        userName: trimmedName,
        date: today,
        type: attendanceType,
      })
      .returning();

    res.status(201).json({
      id: record.id,
      userId: record.userId,
      userName: record.userName,
      date: record.date,
      type: record.type,
      timestamp: record.timestamp,
    });
  } catch (err) {
    req.log.error({ err }, "Error marking attendance");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/attendance", async (req, res) => {
  try {
    const userIdParam = req.query.userId;

    if (!userIdParam) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "ต้องล็อกอินเป็น Admin หรือระบุ userId" });
        return;
      }
      const { verifyAnyAdminToken } = await import("../lib/auth.js");
      const token = authHeader.slice(7);
      const payload = verifyAnyAdminToken(token);
      if (!payload) {
        res.status(401).json({ success: false, error: "Token ไม่ถูกต้องหรือหมดอายุ" });
        return;
      }
    }

    let records;

    if (userIdParam) {
      const userId = parseInt(String(userIdParam), 10);
      if (isNaN(userId)) {
        res.status(400).json({ success: false, error: "Invalid userId" });
        return;
      }
      records = await db
        .select()
        .from(attendanceTable)
        .where(eq(attendanceTable.userId, userId))
        .orderBy(attendanceTable.timestamp);
    } else {
      records = await db
        .select()
        .from(attendanceTable)
        .orderBy(attendanceTable.timestamp);
    }

    res.json({
      records: records.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        date: r.date,
        type: r.type,
        timestamp: r.timestamp,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching attendance");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/attendance/export", adminOnly, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    let records = await db
      .select()
      .from(attendanceTable)
      .orderBy(attendanceTable.timestamp);

    if (userId) {
      const uid = parseInt(String(userId), 10);
      if (!isNaN(uid)) {
        records = records.filter((r) => r.userId === uid);
      }
    }
    if (startDate) {
      records = records.filter((r) => r.date >= String(startDate));
    }
    if (endDate) {
      records = records.filter((r) => r.date <= String(endDate));
    }

    const BOM = "\uFEFF";
    const header = "ชื่อ,วันที่,ประเภท,เวลา\n";
    const rows = records
      .map((r) => {
        const time = new Date(r.timestamp).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const type = r.type === "check_in" ? "เข้าเรียน" : "ออกจากห้องเรียน";
        return `"${r.userName}","${r.date}","${type}","${time}"`;
      })
      .join("\n");

    const filename = `attendance_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(BOM + header + rows);
  } catch (err) {
    req.log.error({ err }, "Error exporting attendance");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
