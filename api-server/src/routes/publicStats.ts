import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, attendanceTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable);
    const today = new Date().toISOString().split("T")[0];
    const allToday = await db.select().from(attendanceTable);
    const todayRecords = allToday.filter((r) => r.date === today);
    const todayCheckIns = new Set(
      todayRecords.filter((r) => r.type === "check_in").map((r) => r.userId)
    );

    res.json({
      totalEmployees: users.length,
      todayCheckIns: todayCheckIns.size,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching public stats");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
