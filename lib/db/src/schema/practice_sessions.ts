import { pgTable, varchar, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lifecycleColumns } from "./base";
import { scenariosTable } from "./scenarios";
import { conversations } from "./conversations";

export const practiceSessionsTable = pgTable("practice_sessions", {
  ...lifecycleColumns,
  scenarioId: varchar("scenario_id", { length: 16 })
    .notNull()
    .references(() => scenariosTable.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id", { length: 16 })
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  durationSeconds: integer("duration_seconds"),
  feedback: text("feedback"),
  score: integer("score"),
});

export const insertPracticeSessionSchema = createInsertSchema(practiceSessionsTable).omit({
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type InsertPracticeSession = z.infer<typeof insertPracticeSessionSchema>;
export type PracticeSession = typeof practiceSessionsTable.$inferSelect;
