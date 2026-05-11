import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { usersTable, attendanceTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { adminOnly } from "../middleware/adminOnly.js";
import { staffOnly } from "../middleware/staffOnly.js";
import { leadOnly } from "../middleware/leadOnly.js";

const router: IRouter = Router();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const WORK_END_HOUR = 17;

function computeStats(records: { type: string; timestamp: Date }[]) {
  const checkInDates = new Set<string>();
  let earlyLeaveCount = 0;
  let otHours = 0;

  for (const r of records) {
    const ts = new Date(r.timestamp);
    const dateKey = ts.toISOString().split("T")[0];
    if (r.type === "check_in") {
      checkInDates.add(dateKey);
    } else if (r.type === "check_out") {
      const hour = ts.getHours();
      const minute = ts.getMinutes();
      if (hour < WORK_END_HOUR) {
        earlyLeaveCount++;
      } else {
        const extra = (hour - WORK_END_HOUR) + minute / 60;
        otHours += extra;
      }
    }
  }

  return {
    workDays: checkInDates.size,
    earlyLeaveCount,
    otHours: Math.round(otHours * 10) / 10,
  };
}

function computeOverallStatus(stats: {
  workDays: number;
  earlyLeaveCount: number;
  absentDays: number;
  sickLeaveDays: number;
  personalLeaveDays: number;
}): string {
  const { absentDays, earlyLeaveCount } = stats;
  if (absentDays === 0 && earlyLeaveCount === 0) return "good";
  if (absentDays > 2 || earlyLeaveCount > 5) return "needs_improvement";
  return "normal";
}

// POST /register — public (anyone can register via face)
router.post("/register", async (req, res) => {
  try {
    const { name, image, faceDescriptor, employeeId, department } = req.body;

    if (!name || !image) {
      res.status(400).json({ success: false, error: "Name and image are required" });
      return;
    }

    const trimmedName = String(name).trim();
    if (!trimmedName) {
      res.status(400).json({ success: false, error: "Name cannot be empty" });
      return;
    }

    const trimmedEmployeeId = employeeId ? String(employeeId).trim() : null;
    const trimmedDepartment = department ? String(department).trim() : null;

    const parsedDescriptor = faceDescriptor && Array.isArray(faceDescriptor)
      ? (faceDescriptor as number[])
      : null;

    if (parsedDescriptor && parsedDescriptor.length !== 128) {
      res.status(400).json({ success: false, error: "Invalid face descriptor — expected 128 values" });
      return;
    }

    if (trimmedEmployeeId) {
      const empIdTaken = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.employeeId, trimmedEmployeeId))
        .limit(1);
      if (empIdTaken.length > 0 && empIdTaken[0].name !== trimmedName) {
        res.status(409).json({ success: false, error: `Employee ID "${trimmedEmployeeId}" is already taken` });
        return;
      }
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.name, trimmedName))
      .limit(1);

    if (existing.length > 0) {
      if (parsedDescriptor) {
        await db
          .update(usersTable)
          .set({
            faceDescriptor: parsedDescriptor,
            ...(trimmedEmployeeId && { employeeId: trimmedEmployeeId }),
            ...(trimmedDepartment && { department: trimmedDepartment }),
          })
          .where(eq(usersTable.name, trimmedName));

        const updated = existing[0];
        res.status(200).json({
          success: true,
          message: `Face descriptor updated for "${trimmedName}"`,
          user: {
            id: updated.id,
            employeeId: updated.employeeId,
            name: updated.name,
            department: updated.department,
            imagePath: updated.imagePath,
            hasFaceDescriptor: true,
            workDays: 0,
            earlyLeaveCount: 0,
            sickLeaveDays: updated.sickLeaveDays,
            personalLeaveDays: updated.personalLeaveDays,
            absentDays: updated.absentDays,
            otHours: 0,
            overallStatus: "normal",
            registeredAt: updated.registeredAt,
          },
        });
        return;
      }
      res.status(409).json({ success: false, error: `User "${trimmedName}" is already registered` });
      return;
    }

    const base64Data = String(image).replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const filename = `${Date.now()}_${trimmedName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    const [user] = await db
      .insert(usersTable)
      .values({
        employeeId: trimmedEmployeeId,
        name: trimmedName,
        department: trimmedDepartment,
        imagePath: `/uploads/${filename}`,
        faceDescriptor: parsedDescriptor,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: `User "${trimmedName}" registered successfully`,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        department: user.department,
        imagePath: user.imagePath,
        hasFaceDescriptor: !!user.faceDescriptor,
        workDays: 0,
        earlyLeaveCount: 0,
        sickLeaveDays: user.sickLeaveDays,
        personalLeaveDays: user.personalLeaveDays,
        absentDays: user.absentDays,
        otHours: 0,
        overallStatus: "good",
        registeredAt: user.registeredAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error registering user");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// GET /users — lead, operation, and teacher can view
router.get("/users", staffOnly, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.name);

    const allAttendance = await db
      .select({
        userId: attendanceTable.userId,
        type: attendanceTable.type,
        timestamp: attendanceTable.timestamp,
      })
      .from(attendanceTable)
      .orderBy(attendanceTable.timestamp);

    const attendanceByUser: Record<number, { type: string; timestamp: Date }[]> = {};
    for (const r of allAttendance) {
      if (!attendanceByUser[r.userId]) attendanceByUser[r.userId] = [];
      attendanceByUser[r.userId].push({ type: r.type, timestamp: r.timestamp });
    }

    res.json({
      users: users.map((u) => {
        const records = attendanceByUser[u.id] || [];
        const stats = computeStats(records);
        const overallStatus = computeOverallStatus({
          ...stats,
          absentDays: u.absentDays,
          sickLeaveDays: u.sickLeaveDays,
          personalLeaveDays: u.personalLeaveDays,
        });
        return {
          id: u.id,
          employeeId: u.employeeId,
          name: u.name,
          department: u.department,
          imagePath: u.imagePath,
          hasFaceDescriptor: !!u.faceDescriptor,
          workDays: stats.workDays,
          earlyLeaveCount: stats.earlyLeaveCount,
          sickLeaveDays: u.sickLeaveDays,
          personalLeaveDays: u.personalLeaveDays,
          absentDays: u.absentDays,
          otHours: stats.otHours,
          overallStatus,
          registeredAt: u.registeredAt,
        };
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching users");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// DELETE /users/:id — Lead only
router.delete("/users/:id", leadOnly, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid user ID" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    await db.delete(attendanceTable).where(eq(attendanceTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));

    res.json({ success: true, message: `ลบนักเรียน "${existing[0].name}" สำเร็จ` });
  } catch (err) {
    req.log.error({ err }, "Error deleting user");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// GET /users/descriptors — public (needed for face recognition check-in)
router.get("/users/descriptors", async (req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        faceDescriptor: usersTable.faceDescriptor,
      })
      .from(usersTable)
      .orderBy(usersTable.name);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        faceDescriptor: u.faceDescriptor ?? undefined,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching user descriptors");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
