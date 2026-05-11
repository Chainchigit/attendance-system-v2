import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, attendanceTable } from "@workspace/db/schema";
import { adminOnly } from "../middleware/adminOnly.js";

const router: IRouter = Router();

router.get("/admin/stats", adminOnly, async (req, res) => {
  try {
    const users = await db.select().from(usersTable);
    const allAttendance = await db.select().from(attendanceTable);

    const today = new Date().toISOString().split("T")[0];
    const todayRecords = allAttendance.filter((r) => r.date === today);
    const todayCheckIns = new Set(
      todayRecords.filter((r) => r.type === "check_in").map((r) => r.userId)
    );
    const todayCheckOuts = new Set(
      todayRecords.filter((r) => r.type === "check_out").map((r) => r.userId)
    );

    const withFace = users.filter((u) => u.faceDescriptor !== null);

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
      registeredFace: withFace.length,
      todayCheckIns: todayCheckIns.size,
      todayCheckOuts: todayCheckOuts.size,
      totalAttendanceRecords: allAttendance.length,
      last7Days,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching admin stats");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
