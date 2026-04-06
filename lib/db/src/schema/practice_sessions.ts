import { pgTable, integer, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const practiceSessionsTable = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  scenarioId: integer("scenario_id").notNull(),
  conversationId: integer("conversation_id").notNull(),
  durationSeconds: integer("duration_seconds"),
  feedback: text("feedback"),
  score: integer("score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPracticeSessionSchema = createInsertSchema(practiceSessionsTable).omit({ id: true, createdAt: true });
export type InsertPracticeSession = z.infer<typeof insertPracticeSessionSchema>;
export type PracticeSession = typeof practiceSessionsTable.$inferSelect;
