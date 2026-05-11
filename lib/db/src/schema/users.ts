import { pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").unique(),
  name: text("name").notNull().unique(),
  department: text("department"),
  imagePath: text("image_path").notNull(),
  faceDescriptor: jsonb("face_descriptor").$type<number[]>(),
  sickLeaveDays: integer("sick_leave_days").notNull().default(0),
  personalLeaveDays: integer("personal_leave_days").notNull().default(0),
  absentDays: integer("absent_days").notNull().default(0),
  registeredAt: timestamp("registered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  registeredAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
