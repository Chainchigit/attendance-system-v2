import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "attendance-system-secret-key-2024";

const DEFAULT_LEAD_USERNAME      = process.env.ADMIN_USERNAME      || "Witchayut nonthapund";
const DEFAULT_OPERATION_USERNAME = process.env.OPERATION_USERNAME  || "admin";
const DEFAULT_TEACHER_USERNAME   = process.env.TEACHER_USERNAME    || "teacher";
const DEFAULT_LEAD_PASSWORD      = process.env.ADMIN_PASSWORD      || "1234";
const DEFAULT_OPERATION_PASSWORD = process.env.OPERATION_PASSWORD  || "admin1234";
const DEFAULT_TEACHER_PASSWORD   = process.env.TEACHER_PASSWORD    || "teacher1234";

const TOKEN_EXPIRY = "8h";

// In-memory state — kept in sync with DB on startup and after every update
let leadUsername      = DEFAULT_LEAD_USERNAME;
let operationUsername = DEFAULT_OPERATION_USERNAME;
let teacherUsername   = DEFAULT_TEACHER_USERNAME;
let leadPassword      = DEFAULT_LEAD_PASSWORD;
let operationPassword = DEFAULT_OPERATION_PASSWORD;
let teacherPassword   = DEFAULT_TEACHER_PASSWORD;

export async function initializeAuth(): Promise<void> {
  try {
    const { db } = await import("@workspace/db");
    const { settingsTable } = await import("@workspace/db/schema");
    const rows = await db.select().from(settingsTable);
    for (const row of rows) {
      if (row.key === "lead_username")      leadUsername      = row.value;
      if (row.key === "admin_password")     leadPassword      = row.value;
      if (row.key === "operation_username") operationUsername = row.value;
      if (row.key === "operation_password") operationPassword = row.value;
      if (row.key === "teacher_username")   teacherUsername   = row.value;
      if (row.key === "teacher_password")   teacherPassword   = row.value;
    }
  } catch {
    // Fall back to defaults
  }
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const { db } = await import("@workspace/db");
  const { settingsTable } = await import("@workspace/db/schema");
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

/** Update Lead account credentials (username and/or password). */
export async function updateLeadCredentials(
  newUsername: string | null,
  newPassword: string | null
): Promise<void> {
  if (newUsername) {
    await upsertSetting("lead_username", newUsername);
    leadUsername = newUsername;
  }
  if (newPassword) {
    await upsertSetting("admin_password", newPassword);
    leadPassword = newPassword;
  }
}

/** Update Operation account password. */
export async function updateOperationPassword(newPassword: string): Promise<void> {
  await upsertSetting("operation_password", newPassword);
  operationPassword = newPassword;
}

/** Update Teacher account credentials (username and/or password). */
export async function updateTeacherCredentials(
  newUsername: string | null,
  newPassword: string | null
): Promise<void> {
  if (newUsername) {
    await upsertSetting("teacher_username", newUsername);
    teacherUsername = newUsername;
  }
  if (newPassword) {
    await upsertSetting("teacher_password", newPassword);
    teacherPassword = newPassword;
  }
}

/** Current teacher username (for display). */
export function getTeacherUsername(): string {
  return teacherUsername;
}

// Legacy alias
export const updateLeadPassword = (p: string) => updateLeadCredentials(null, p);
export const updateAdminPassword = updateLeadPassword;

export type AdminRole = "lead" | "operation" | "teacher";

export interface AdminPayload {
  role: AdminRole;
  username: string;
  teacherId?: number;
  faculty?: string;
  department?: string;
  subject?: string;
  displayName?: string;
}

/** Returns the role if credentials match lead/operation, or null. */
export function verifyAdminCredentials(username: string, password: string): AdminRole | null {
  if (username === leadUsername      && password === leadPassword)      return "lead";
  if (username === operationUsername && password === operationPassword) return "operation";
  if (username === teacherUsername   && password === teacherPassword)   return "teacher";
  return null;
}

/** Verify teacher credentials from DB. Returns teacher row or null. */
export async function verifyTeacherFromDB(
  username: string,
  password: string
): Promise<{ id: number; username: string; displayName: string; faculty: string; department: string; subject: string } | null> {
  try {
    const { db } = await import("@workspace/db");
    const { teachersTable } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");
    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.username, username))
      .limit(1);
    if (!teacher || teacher.password !== password) return null;
    return {
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.displayName,
      faculty: teacher.faculty,
      department: teacher.department,
      subject: teacher.subject,
    };
  } catch {
    return null;
  }
}

/** Current lead username (for display in the Settings UI). */
export function getLeadUsername(): string {
  return leadUsername;
}

export function signAdminToken(
  username: string,
  role: AdminRole,
  teacher?: { id: number; faculty: string; department: string; subject: string; displayName: string }
): string {
  const payload: AdminPayload = { role, username };
  if (teacher) {
    payload.teacherId   = teacher.id;
    payload.faculty     = teacher.faculty;
    payload.department  = teacher.department;
    payload.subject     = teacher.subject;
    payload.displayName = teacher.displayName;
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminPayload;
    if (payload.role !== "lead" && payload.role !== "operation") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Accepts any role (lead, operation, teacher). */
export function verifyAnyAdminToken(token: string): AdminPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminPayload;
    if (!["lead", "operation", "teacher"].includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}
