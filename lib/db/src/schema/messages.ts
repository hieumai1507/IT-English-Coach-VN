import { varchar, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lifecycleColumns } from "./base";
import { conversations } from "./conversations";

export const messages = pgTable("messages", {
  ...lifecycleColumns,
  conversationId: varchar("conversation_id", { length: 16 })
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
