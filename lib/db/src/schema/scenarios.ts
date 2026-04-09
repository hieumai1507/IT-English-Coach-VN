import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lifecycleColumns } from "./base";

export const scenariosTable = pgTable("scenarios", {
  ...lifecycleColumns,
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  difficulty: varchar("difficulty", { length: 50 }).notNull(),
  systemPrompt: text("system_prompt").notNull(),
  icon: varchar("icon", { length: 50 }).notNull().default("MessageSquare"),
});

export const insertScenarioSchema = createInsertSchema(scenariosTable).omit({
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Scenario = typeof scenariosTable.$inferSelect;
