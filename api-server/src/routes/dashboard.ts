import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, attendanceTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { adminOnly } from "../middleware/adminOnly.js";
import { staffOnly } from "../middleware/staffOnly.js";

const router: IRouter = Router();

router.get("/dashboard/user", async (req, res) => {
  try {
    const userIdParam = req.query.userId;
    if (!userIdParam) {
      res.status(400).json({ success: false, error: "userId is required" });
      return;
    }
    const userId = parseInt(String(userIdParam), 10);
    if (isNaN(userId)) {
      res.status(400).json({ success: false, error: "Invalid userId" });
      return;
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (users.length === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const user = users[0];
    const records = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.userId, userId))
      .orderBy(attendanceTable.timestamp);

    const today = new Date().toISOString().split("T")[0];
    const todayRecords = records.filter((r) => r.date === today);

    const workDays = new Set(
      records.filter((r) => r.type === "check_in").map((r) => r.date)
    ).size;

    const totalCheckIns = records.filter((r) => r.type === "check_in").length;
    const totalCheckOuts = records.filter((r) => r.type === "check_out").length;

    const lastCheckInRecord = [...records]
      .reverse()
      .find((r) => r.type === "check_in");

    const last7Days: { date: string; checkIns: number; checkOuts: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayRecords = records.filter((r) => r.date === dateStr);
      last7Days.push({
        date: dateStr,
        checkIns: dayRecords.filter((r) => r.type === "check_in").length,
        checkOuts: dayRecords.filter((r) => r.type === "check_out").length,
      });
    }

    res.json({
      userId: user.id,
      userName: user.name,
      department: user.department,
      workDays,
      totalCheckIns,
      totalCheckOuts,
      lastCheckIn: lastCheckInRecord?.timestamp ?? null,
      todayRecords: todayRecords.map((r) => ({
        id: r.id,
        type: r.type,
        timestamp: r.timestamp,
      })),
      last7Days,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching user dashboard");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/dashboard/admin", staffOnly, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.name);
    const allAttendance = await db
      .select()
      .from(attendanceTable)
      .orderBy(attendanceTable.timestamp);

    const today = new Date().toISOString().split("T")[0];
    const todayRecords = allAttendance.filter((r) => r.date === today);

    // Build a map of each user's LAST record today (records are ordered by timestamp)
    const userTodayLastRecord: Record<number, typeof todayRecords[0]> = {};
    for (const r of todayRecords) {
      userTodayLastRecord[r.userId] = r;
    }

    const employeeSummary = users.map((u) => {
      const userRecords = allAttendance.filter((r) => r.userId === u.id);
      const workDays = new Set(
        userRecords.filter((r) => r.type === "check_in").map((r) => r.date)
      ).size;

      // Status = last record of today (not just "has any check_out")
      const lastTodayRecord = userTodayLastRecord[u.id];
      let todayStatus: "present" | "checked_out" | "absent" = "absent";
      if (lastTodayRecord?.type === "check_in") todayStatus = "present";
      else if (lastTodayRecord?.type === "check_out") todayStatus = "checked_out";

      const lastRecord = [...userRecords].pop();

      return {
        id: u.id,
        name: u.name,
        department: u.department,
        workDays,
        todayStatus,
        lastActivity: lastRecord?.timestamp ?? null,
      };
    });

    const todayPresentCount    = employeeSummary.filter((e) => e.todayStatus === "present" || e.todayStatus === "checked_out").length;
    const todayCheckedOutCount = todayRecords.filter((r) => r.type === "check_out").length;
    const todayAbsentCount     = employeeSummary.filter((e) => e.todayStatus === "absent").length;

    const last7Days: { date: string; checkIns: number; checkOuts: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayRecords = allAttendance.filter((r) => r.date === dateStr);
      last7Days.push({
        date: dateStr,
        checkIns: dayRecords.filter((r) => r.type === "check_in").length,
        checkOuts: dayRecords.filter((r) => r.type === "check_out").length,
      });
    }

    res.json({
      totalEmployees: users.length,
      todayPresent: todayPresentCount,
      todayCheckedOut: todayCheckedOutCount,
      todayAbsent: todayAbsentCount,
      employeeSummary,
      last7Days,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching admin dashboard");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
