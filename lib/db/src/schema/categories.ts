import { pgTable, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lifecycleColumns } from "./base";

export const categoriesTable = pgTable("categories", {
  ...lifecycleColumns,
  name: varchar("name", { length: 100 }).notNull().unique(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
