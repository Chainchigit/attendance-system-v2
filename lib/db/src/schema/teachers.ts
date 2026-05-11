import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const teachersTable = pgTable("teachers", {
  id:          serial("id").primaryKey(),
  username:    text("username").notNull().unique(),
  password:    text("password").notNull(),
  displayName: text("display_name").notNull(),
  faculty:     text("faculty").notNull(),
  department:  text("department").notNull(),
  subject:     text("subject").notNull().default(""),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Teacher       = typeof teachersTable.$inferSelect;
export type InsertTeacher = typeof teachersTable.$inferInsert;
