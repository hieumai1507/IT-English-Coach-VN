import { varchar, timestamp } from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

/**
 * Common columns for all tables to ensure consistency.
 * Includes ID (16 chars), lifecycle timestamps, and soft-delete field.
 */
export const lifecycleColumns = {
  id: varchar("id", { length: 16 }).primaryKey().$defaultFn(() => generateId()),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
